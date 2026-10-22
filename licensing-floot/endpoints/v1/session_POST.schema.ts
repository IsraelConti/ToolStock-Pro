import {z} from 'zod';
export const schema=z.object({idToken:z.string().min(20).max(8192),purchaseToken:z.string().min(20).max(4096)}).strict();
export type InputType=z.infer<typeof schema>;
export async function postSession(input:InputType){const response=await fetch('/_api/v1/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(schema.parse(input))});if(!response.ok)throw new Error('No se pudo vincular la compra');return response.json()}
