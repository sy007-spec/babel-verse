import {db} from '../../../lib/db';
export const dynamic='force-dynamic';
export async function GET(){try{await db.query('SELECT version FROM schema_versions WHERE version=1');return Response.json({status:'ok',version:process.env.APP_VERSION||'dev',login:!!process.env.OIDC_CLIENT_ID,moderation:!!process.env.LLM_API_KEY});}catch{return Response.json({status:'unavailable'},{status:503});}}
