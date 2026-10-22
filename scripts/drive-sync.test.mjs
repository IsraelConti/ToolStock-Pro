import assert from 'node:assert/strict';
import { DriveSync } from '../src/drive-sync.js';
import { canonical, cleanState, mergeStates, resolveConflict, stampChanges } from '../src/drive-state.js';
import { createGoogleDriveRpc } from '../src/google-drive-rpc.js';

const blank=()=>({version:2,equipment:[],orders:[],plans:[],team:[],settings:{companyName:'Taller'},conflicts:[]});
const row=(id,name)=>({id,name,updatedAt:'2026-10-21T12:00:00.000Z'});
const files=new Map();let serial=0,offline=false,account='account-one',writes=0;
function device(id,initial=blank()){
 let state=initial; const config={deviceId:id,accountId:'',counter:0};
 const transport=async data=>{
  if(offline)throw new Error('offline');
  if(data.op==='status')return {configured:true,connected:true,entitled:true,accountId:account,email:'synthetic@example.invalid'};
  if(data.op==='list')return {files:[...files].filter(([,v])=>v.accountId===account).map(([key,v])=>({id:key,deviceId:v.deviceId}))};
  if(data.op==='read')return structuredClone(files.get(data.fileId));
  if(data.op==='write'){writes++; files.set(data.fileId||`file-${++serial}`,structuredClone(data.document));return {id:data.fileId||`file-${serial}`};}
 };
 const client=new DriveSync({transport,readState:()=>state,applyState:next=>{state=next;return true;},config,persist:()=>{},now:()=>new Date().toISOString()});
 return {client,config,get state(){return state;},set state(value){state=value;},edit(fn){const old=structuredClone(state);fn(state);const stamped=stampChanges(old,state,id,config.counter);state=stamped.state;config.counter=stamped.counter;}};
}
const mobile=device('mobile'),pc=device('pc');
mobile.edit(s=>s.equipment.push(row('pump','Bomba'))); await mobile.client.sync(); await pc.client.sync();
assert.equal(pc.state.equipment[0].name,'Bomba');
pc.edit(s=>s.orders.push({...row('order-one','Revisar retenes'),equipmentId:'pump'})); await pc.client.sync(); await mobile.client.sync();
assert.equal(mobile.state.orders[0].name,'Revisar retenes');
// Both edit while offline, starting from the same causal version.
mobile.edit(s=>{s.equipment[0].name='Cambio móvil';}); pc.edit(s=>{s.equipment[0].name='Cambio PC';});
await mobile.client.sync();await pc.client.sync();await mobile.client.sync();
assert.equal(canonical(mobile.state),canonical(pc.state));
assert.ok(mobile.state.conflicts.some(c=>c.id==='pump'));
const alternative=mobile.state.conflicts.find(c=>c.id==='pump');
const resolved=resolveConflict(mobile.state,alternative,true,'mobile',mobile.config.counter); mobile.state=resolved.state;mobile.config.counter=resolved.counter;
await mobile.client.sync();await pc.client.sync();await mobile.client.sync();
assert.equal(canonical(mobile.state),canonical(pc.state));assert.equal(pc.state.conflicts.length,0);
// Deletions carry vectors and a returning old device cannot resurrect them.
const oldPhone=device('old-phone',structuredClone(pc.state));
mobile.edit(s=>{s.equipment[0].deletedAt='2026-10-21T13:00:00.000Z';});
await mobile.client.sync();await oldPhone.client.sync();await pc.client.sync();
assert.equal(pc.state.equipment[0].deletedAt,'2026-10-21T13:00:00.000Z');
const before=canonical(pc.state);offline=true; await assert.rejects(pc.client.sync());assert.equal(canonical(pc.state),before);assert.equal(pc.config.pending,true);offline=false;await pc.client.sync();assert.equal(pc.config.pending,false);
// An account switch cannot leak the local records into the other Drive.
account='account-two';const count=writes;await assert.rejects(pc.client.sync(),/account-mismatch/);assert.equal(writes,count);account='account-one';
// An edit during the upload is preserved locally and marked for another upload.
const changing=device('slow-pc');let changed=false;const transport=changing.client.transport;
changing.client.transport=async data=>{if(data.op==='write'&&!changed){changed=true;changing.edit(s=>s.team.push(row('tech','Técnico')));}return transport(data);};
await changing.client.sync();assert.equal(changing.state.team[0].name,'Técnico');assert.equal(changing.config.pending,true);changing.client.stop();
// Refuse partial/invalid downloads without overwriting the local copy or Drive.
const broken=device('broken-client');files.set('bad-file',{schema:'another.schema',deviceId:'bad',accountId:account,state:blank()});const beforeBad=writes;await assert.rejects(broken.client.sync(),/invalid-document/);assert.equal(writes,beforeBad);files.delete('bad-file');
const a={...blank(),equipment:[row('tie','A')]},b={...blank(),equipment:[row('tie','B')]};
assert.equal(canonical(mergeStates([a,b])),canonical(mergeStates([b,a])));
// Private settings (old folder URI, session data) are never synchronized.
assert.equal(cleanState({...blank(),settings:{companyName:'Taller',driveName:'private-local',token:'must-not-leave-device'}}).settings.token,undefined);

const calls=[];let page=0;
const rpc=createGoogleDriveRpc({getAccessToken:async()=> 'synthetic-native-token',getSession:async()=>({configured:true,connected:true,entitled:true,accountId:'account-one'}),ensureEntitlement:async()=>true,fetchImpl:async(url,opt)=>{
 calls.push({url:String(url),options:opt});
 if(String(url).includes('spaces='))return new Response(JSON.stringify(++page===1?{files:[],nextPageToken:'second'}:{files:[{id:'native-file',appProperties:{deviceId:'mobile'}}]}));
 return new Response(JSON.stringify({id:'native-file',appProperties:{schema:'maintenpro.drive.v1',deviceId:'other-device'}}));
}});
assert.equal((await rpc({op:'list'})).files.length,1);assert.ok(calls[1].url.includes('pageToken=second'));
await assert.rejects(rpc({op:'write',fileId:'native-file',deviceId:'mobile',document:{schema:'maintenpro.drive.v1',deviceId:'mobile',accountId:'account-one',state:blank()}}),/wrong-device-file/);
assert.equal(calls.filter(c=>c.options.method==='PATCH').length,0);
const denied=createGoogleDriveRpc({getAccessToken:async()=>'',getSession:async()=>({configured:true,connected:true,accountId:'account-one'}),ensureEntitlement:async()=>false,fetchImpl:async()=>{throw new Error('unexpected-network');}});
await assert.rejects(denied({op:'list'}),/purchase-required/);
for(const d of [mobile,pc,oldPhone,broken,changing])d.client.stop();
console.log('Drive sync: mobile→PC→mobile, concurrent edits and resolution, tombstones, offline retry, account isolation, edits during upload, invalid documents, pagination and ownership all passed.');
