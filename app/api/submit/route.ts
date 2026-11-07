import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '../../../lib/db';
import {guard,quota} from '../../../lib/security';
import {checkRevision,fingerprint,moods,safeLanguage,normalizeSearch} from '../../../lib/rules';
const text=z.string().trim().min(1).max(5000),uuid=z.string().uuid();
const schema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('work'),title:text.max(200),poet:text.max(200),language:text.max(35),body:text,source_url:z.url().max(1000),citation:text.max(1000),rights:z.literal('public-domain'),period:text.max(100),genre:z.enum(['shi','ci','other'])}),
 z.object({kind:z.literal('translation'),work_id:uuid,language:text.max(35),body:text,ai_use:z.enum(['human','assisted','generated']),mirror_consent:z.literal(true),commercial_consent:z.boolean()}),
 z.object({kind:z.literal('revision'),translation_id:uuid,body:text}),
 z.object({kind:z.literal('vote'),translation_id:uuid,version_id:uuid,score:z.number().int().min(1).max(5),confirmed:z.literal(true)}),
 z.object({kind:z.literal('tag'),work_id:uuid,labels:z.array(z.enum(moods)).min(1).max(3),reason:text.max(500)})]);
async function limitedBody(req:Request){const reader=req.body?.getReader();if(!reader)throw new Error('BODY');let n=0;const parts:Uint8Array[]=[];while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>32768){await reader.cancel();throw new Error('TOO_LARGE');}parts.push(r.value);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
export async function POST(req:Request){let c;try{
 const s=schema.parse(await limitedBody(req));const limit={work:2,translation:3,revision:10,vote:30,tag:5}[s.kind];const a=await guard(s.kind,limit);
 if(s.kind==='vote')await quota('vote-minute:'+a.id,5,60);
 if(s.kind==='revision')await quota('revision:'+a.id+':'+s.translation_id,1,86400);
 c=await db.connect();await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext($1))",[a.id]);
 let id=randomUUID(),target=id,job=s.kind==='translation'||s.kind==='revision'?'version':s.kind;
 if(s.kind==='work'){
  const source=new URL(s.source_url);if(source.protocol!=='https:'||source.username||source.password)throw new Error('SOURCE_HTTPS_REQUIRED');
  await c.query('INSERT INTO works(id,author_id,title,poet,language,body,fingerprint,source_url,citation,rights,period,genre) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,a.id,s.title,s.poet,safeLanguage(s.language),s.body,fingerprint(s.body),s.source_url,s.citation,s.rights,s.period,s.genre]);
 }else if(s.kind==='translation'){
  const w=await c.query("SELECT id FROM works WHERE id=$1 AND status='published'",[s.work_id]);if(!w.rowCount)throw new Error('NOT_FOUND');
  await c.query('INSERT INTO translations(id,work_id,author_id,device,language,ai_use,mirror_consent,commercial_consent) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,s.work_id,a.id,a.device,safeLanguage(s.language),s.ai_use,s.mirror_consent,s.commercial_consent]);target=randomUUID();await c.query('INSERT INTO versions(id,translation_id,body) VALUES($1,$2,$3)',[target,id,s.body]);
 }else if(s.kind==='revision'){
  const t=await c.query('SELECT * FROM translations WHERE id=$1 AND author_id=$2 FOR UPDATE',[s.translation_id,a.id]);if(!t.rowCount)throw new Error('NOT_FOUND');
  const v=await c.query("SELECT body,status FROM versions WHERE translation_id=$1 ORDER BY created_at,id",[s.translation_id]);if(v.rows.some(x=>x.status==='pending'||x.status==='review'))throw new Error('REVIEW_PENDING');const published=v.rows.filter(x=>x.status==='published');const first=published[0]?.body||v.rows[0].body,previous=published.at(-1)?.body||v.rows.at(-1).body;if(!checkRevision(first,previous,s.body))throw new Error('CHANGE_OVER_30_PERCENT');
  await c.query('INSERT INTO versions(id,translation_id,body) VALUES($1,$2,$3)',[id,s.translation_id,s.body]);
 }else if(s.kind==='vote'){
  const t=await c.query(`SELECT t.author_id,v.id FROM translations t JOIN LATERAL(SELECT id FROM versions WHERE translation_id=t.id AND status='published' ORDER BY created_at DESC,id DESC LIMIT 1) v ON true JOIN works w ON w.id=t.work_id AND w.status='published' WHERE t.id=$1 FOR UPDATE OF t`,[s.translation_id]);if(!t.rowCount)throw new Error('NOT_FOUND');if(t.rows[0].author_id===a.id)throw new Error('SELF_VOTE');if(t.rows[0].id!==s.version_id)throw new Error('VERSION_CHANGED');
  await c.query('INSERT INTO votes(id,translation_id,version_id,author_id,device,score) VALUES($1,$2,$3,$4,$5,$6)',[id,s.translation_id,s.version_id,a.id,a.device,s.score]);
 }else{
  const w=await c.query("SELECT id FROM works WHERE id=$1 AND status='published'",[s.work_id]);if(!w.rowCount)throw new Error('NOT_FOUND');
  await c.query('INSERT INTO tags(id,work_id,author_id,device,labels,reason) VALUES($1,$2,$3,$4,$5,$6)',[id,s.work_id,a.id,a.device,JSON.stringify([...new Set(s.labels)]),s.reason]);
 }
 if(s.kind==='work')await c.query('UPDATE works SET search_text=$2 WHERE id=$1',[id,normalizeSearch(s.title+' '+s.poet+' '+s.body)]);
 if(s.kind!=='vote')await c.query('INSERT INTO jobs(id,kind,target) VALUES($1,$2,$3)',[randomUUID(),job,target]);await c.query('COMMIT');return Response.json({id,status:s.kind==='vote'?'recorded':'pending'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(c)await c.query('ROLLBACK');const err=e as {code?:string,message?:string};const message=err.code==='23505'?'ALREADY_SUBMITTED':e instanceof z.ZodError?'INVALID_INPUT':err.message||'UNAVAILABLE';const allowed=['ALREADY_SUBMITTED','INVALID_INPUT','RATE_LIMIT','LOGIN_REQUIRED','ORIGIN','SOURCE_HTTPS_REQUIRED','NOT_FOUND','REVIEW_PENDING','CHANGE_OVER_30_PERCENT','SELF_VOTE','VERSION_CHANGED','TOO_LARGE'];return Response.json({error:allowed.includes(message)?message:'UNAVAILABLE'},{status:message==='LOGIN_REQUIRED'?401:message==='RATE_LIMIT'?429:message==='ALREADY_SUBMITTED'?409:400});}finally{c?.release();}}
