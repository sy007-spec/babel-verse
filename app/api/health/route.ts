import {db} from '../../../lib/db';
import {cache} from '../../../lib/security';
export const dynamic='force-dynamic';
export async function GET(){try{const schema=await db.query('SELECT version FROM schema_versions WHERE version=1');if(!schema.rowCount)throw Error();const moderation=await(await cache()).get('worker:ready')==='yes';return Response.json({status:'ok',version:process.env.APP_VERSION||'dev',login:!!(process.env.OIDC_CLIENT_ID&&process.env.OIDC_ORG_ID),moderation});}catch{return Response.json({status:'unavailable'},{status:503});}}
