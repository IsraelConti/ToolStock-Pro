import {activeLicense,googleIdentity,licenseResponse,licenseFailure} from '../../helpers/googleDriveLicense';
export const flootPublic=true;
export async function handle(request:Request){try{return licenseResponse(await activeLicense(await googleIdentity(request)))}catch(e){return licenseFailure(e)}}
