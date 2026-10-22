import { createCipheriv, createDecipheriv, createHash, randomBytes, createPrivateKey } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { sql } from 'kysely';
import { db } from './db';
import { maintenProGoogleClientIds } from './maintenProOauthConfig';
import { verifyMaintenProPurchase, PlayVerificationError } from './googlePlayEntitlement';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const productId='maintenpro_premium_monthly';
export class LicenseError extends Error { constructor(message:string, public status=401){super(message)} }
export function licenseConfigured(){
  if(!maintenProGoogleClientIds.length||!process.env.JWT_SECRET)return false;
  try{
    const account=JSON.parse((process.env as Record<string,string|undefined>)["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]||'');
    return account.type==='service_account'&&typeof account.client_email==='string'&&account.client_email.endsWith('.iam.gserviceaccount.com')&&createPrivateKey(account.private_key).asymmetricKeyType==='rsa';
  }catch{return false}
}
export function licenseResponse(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
export function licenseFailure(error:unknown){
  const malformed=error instanceof SyntaxError||(error instanceof Error&&error.name==="ZodError");
  const status=malformed?400:error instanceof LicenseError||error instanceof PlayVerificationError?error.status:503;
  const message=malformed?'invalid-request':error instanceof LicenseError?error.message:error instanceof PlayVerificationError?(status===403?'purchase-required':'licence-unavailable'):'licence-unavailable';
  return licenseResponse({ok:false,error:message,entitlement:{active:false,serverValidated:false,productId}},status);
}
export async function googleIdentity(request:Request,explicit=''){
  if(!licenseConfigured())throw new LicenseError('configuration-missing',503);
  const token=explicit||(/^Bearer (\S+)$/.exec(request.headers.get('authorization')||'')?.[1]||'');
  if(!token||token.length>8192)throw new LicenseError('authorization-required');
  let subject='',email='';
  try{
    if(token.split('.').length===3){
      const {payload}=await jwtVerify(token,jwks,{audience:maintenProGoogleClientIds,issuer:['accounts.google.com','https://accounts.google.com']});
      if(payload.email_verified!==true||typeof payload.sub!=='string'||typeof payload.email!=='string')throw Error();
      subject=payload.sub;email=payload.email;
    }else{
      const infoReply=await fetch('https://oauth2.googleapis.com/tokeninfo',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(15000)});
      const info=infoReply.ok?await infoReply.json():null;
      if(!info||!maintenProGoogleClientIds.includes(info.aud)||!(Number(info.expires_in)>0))throw Error();
      const profileReply=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
      const profile=profileReply.ok?await profileReply.json():null;
      if(!profile?.sub||profile.email_verified!==true||!profile.email||(info.sub&&info.sub!==profile.sub))throw Error();
      subject=profile.sub;email=profile.email;
    }
  }catch{throw new LicenseError('authorization-required')}
  if(!/^[\w-]{1,128}$/.test(subject))throw new LicenseError('authorization-required');
  return {subject,email};
}
const receiptHash=(value:string)=>createHash('sha256').update(value).digest('hex');
function receiptKey(){const seed=process.env.JWT_SECRET;if(!seed)throw new LicenseError('configuration-missing',503);return createHash('sha256').update('maintenpro-play-receipt-v1\0'+seed).digest()}
function encryptReceipt(value:string,subject:string){
  const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',receiptKey(),iv);c.setAAD(Buffer.from(subject));
  const data=Buffer.concat([c.update(value,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');
}
function decryptReceipt(value:string,subject:string){try{const raw=Buffer.from(value,'base64');const d=createDecipheriv('aes-256-gcm',receiptKey(),raw.subarray(0,12));d.setAAD(Buffer.from(subject));d.setAuthTag(raw.subarray(12,28));return Buffer.concat([d.update(raw.subarray(28)),d.final()]).toString('utf8')}catch{throw new LicenseError('purchase-required',403)}}
export async function activeLicense(user:{subject:string,email:string},purchaseToken=''){
  if(purchaseToken&&(purchaseToken.length<20||purchaseToken.length>4096))throw new LicenseError('invalid-purchase',400);
  const row=await db.transaction().execute(async trx=>{
    await sql`select set_config('app.google_sub',${user.subject},true)`.execute(trx);
    return trx.selectFrom('googlePlayLicenses').selectAll().where('googleSub','=',user.subject).executeTakeFirst();
  });
  if(!purchaseToken&&!row)throw new LicenseError('purchase-required',403);
  if(!purchaseToken&&row&&new Date(row.lastVerifiedAt).getTime()>Date.now()-300000&&new Date(row.expiresAt).getTime()>Date.now())return {ok:true,entitlement:{active:true,serverValidated:true,productId,expiresAt:new Date(row.expiresAt).toISOString()}};
  const receipt=purchaseToken||decryptReceipt(row!.purchaseTokenCipher,user.subject);
  const verified=await verifyMaintenProPurchase(receipt,user.subject);
  const values={email:user.email,purchaseTokenHash:receiptHash(receipt),purchaseTokenCipher:encryptReceipt(receipt,user.subject),subscriptionState:verified.subscriptionState,expiresAt:verified.expiresAt,lastVerifiedAt:new Date()};
  try{await db.transaction().execute(async trx=>{
    await sql`select set_config('app.google_sub',${user.subject},true)`.execute(trx);
    await trx.insertInto('googlePlayLicenses').values({googleSub:user.subject,...values}).onConflict(c=>c.column('googleSub').doUpdateSet(values)).execute();
  })}catch(e){if(e&&typeof e==='object'&&'code'in e&&e.code==='23505')throw new LicenseError('purchase-already-linked',409);throw e}
  return {ok:true,entitlement:{active:true,serverValidated:true,productId,expiresAt:verified.expiresAt.toISOString()}};
}
