import {z} from 'zod';
import {actor,guard} from '../../../lib/security';
import {accountAction,accountSection,applyAccountAction,ACTION_LIMIT,SECTIONS,type Section} from '../../../lib/account';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(req:Request){try{const a=await actor();if(!a)return Response.json({error:'LOGIN_REQUIRED'},{status:401,headers});const section=(new URL(req.url).searchParams.get('section')||'summary') as Section;if(!SECTIONS.includes(section))return Response.json({error:'INVALID_INPUT'},{status:400,headers});return Response.json(await accountSection(a.id,section),{headers});}catch{return Response.json({error:'UNAVAILABLE'},{status:503,headers});}}
export async function POST(req:Request){try{const text=await req.text();if(text.length>2048)throw new Error('TOO_LARGE');const s=accountAction.parse(JSON.parse(text));const a=await guard('account:'+s.action,ACTION_LIMIT[s.action]);
 if(!await applyAccountAction(a.id,s))throw new Error('NOT_FOUND');return Response.json({ok:true},{headers});
}catch(e){const m=e instanceof z.ZodError||e instanceof SyntaxError?'INVALID_INPUT':(e as Error).message;const known=['LOGIN_REQUIRED','RATE_LIMIT','ORIGIN','NOT_FOUND','TOO_LARGE','INVALID_INPUT'];const error=known.includes(m)?m:'UNAVAILABLE';return Response.json({error},{status:{LOGIN_REQUIRED:401,RATE_LIMIT:429,ORIGIN:403,NOT_FOUND:404}[error as 'NOT_FOUND']||(error==='UNAVAILABLE'?503:400),headers});}}
