export type OutputType={ok:boolean;version:string;configured:boolean;dataStorage:string};
export async function getHealth():Promise<OutputType>{return (await fetch('/_api/v1/health')).json()}
