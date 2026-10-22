import {licenseConfigured,licenseResponse} from '../../helpers/googleDriveLicense';
export const flootPublic=true;
export async function handle(){return licenseResponse({ok:true,version:'1.2.9',configured:licenseConfigured(),dataStorage:'customer-google-drive'})}
