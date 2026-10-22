import {schema} from './session_POST.schema';
import {activeLicense,googleIdentity,licenseResponse,licenseFailure,LicenseError} from '../../helpers/googleDriveLicense';
export const flootPublic=true;
export async function handle(request:Request){
  try{const raw=await request.text();if(raw.length>16384)throw new LicenseError('payload-too-large',413);const body=schema.parse(JSON.parse(raw));const user=await googleIdentity(request,body.idToken);return licenseResponse(await activeLicense(user,body.purchaseToken))}catch(e){return licenseFailure(e)}
}
