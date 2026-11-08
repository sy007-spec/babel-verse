import {isolatedSession,signInOrganizations} from './identity';
import {createHmac,randomBytes} from 'node:crypto';
import {cookies,headers} from 'next/headers';
import {createClient} from 'redis';
export const redis=createClient({url:process.env.REDIS_URL});
redis.on('error',()=>{});
let connecting:Promise<unknown>|undefined;
export async function cache(){if(!redis.isOpen)connecting??=redis.connect().finally(()=>{connecting=undefined});if(connecting)await connecting;return redis;}
export function digest(s:string){if(!process.env.IDENTITY_SECRET)throw new Error('IDENTITY_NOT_CONFIGURED');return createHmac('sha256',process.env.IDENTITY_SECRET).update(s).digest('hex');}
export async function actor(){const c=await cookies(),token=c.get('bv_session')?.value;if(!token)return null;const r=await cache();const v=await r.get('session:'+digest(token));return v?isolatedSession(JSON.parse(v) as {id:string,name:string,org?:string},signInOrganizations(process.env.OIDC_ORG_ID,process.env.OIDC_LOGIN_ORG_IDS)):null;}
export async function device(){const c=await cookies();let v=c.get('bv_device')?.value;const [id,sig]=v?.split('.')||[];if(!id||sig!==digest('device:'+id)){const id=randomBytes(32).toString('hex');v=id+'.'+digest('device:'+id);c.set('bv_device',v,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:31536000,path:'/'});}return digest(v!);}
export async function network(){const h=await headers();return digest('ip:'+(h.get('x-real-ip')||'unknown'));}
export async function quota(key:string,limit:number,seconds:number){const r=await cache();const n=Number(await r.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n",{keys:['limit:'+key],arguments:[String(seconds)]}));if(n>limit)throw new Error('RATE_LIMIT');}
export async function guard(kind:string,limit:number){const h=await headers();if(h.get('origin')!==process.env.PUBLIC_ORIGIN)throw new Error('ORIGIN');const a=await actor();if(!a)throw new Error('LOGIN_REQUIRED');const d=await device(),ip=await network();await quota('global:write',2000,60);await quota('ip:'+ip,120,60);await quota('device:'+d+':'+kind,limit,86400);await quota('user:'+a.id+':'+kind,limit,86400);return {...a,device:d};}
