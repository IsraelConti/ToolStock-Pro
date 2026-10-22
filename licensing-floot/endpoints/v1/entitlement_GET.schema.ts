export type OutputType={ok:boolean;entitlement:{active:boolean;serverValidated:boolean;productId:string;expiresAt?:string}};
export async function getEntitlement(token:string):Promise<OutputType>{const response=await fetch('/_api/v1/entitlement',{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('No se pudo comprobar la compra');return response.json()}
