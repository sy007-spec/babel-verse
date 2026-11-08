/** Organizations whose accounts may sign in: the Babelverse Readers org (OIDC_ORG_ID, open sign-up) plus OIDC_LOGIN_ORG_IDS (e.g. SEII main org). */
export function signInOrganizations(signupOrg:string|undefined,extra:string|undefined):string[]{
 return [...new Set([signupOrg,...(extra||'').split(',')].map(o=>(o||'').trim()).filter(o=>/^\d{1,30}$/.test(o)))];
}
export function organizationOf(claims:Record<string,unknown>,orgs:string[]):string|null{
 const org=claims['urn:zitadel:iam:user:resourceowner:id'];
 return typeof org==='string'&&orgs.includes(org)?org:null;
}
export function organizationMatches(claims:Record<string,unknown>,org:string|undefined){
 return !!org&&organizationOf(claims,[org])===org;
}
export function isolatedSession<T extends {org?:string}>(session:T,orgs:string|string[]|undefined):T|null{
 const allowed=Array.isArray(orgs)?orgs:orgs?[orgs]:[];
 return session.org&&allowed.includes(session.org)?session:null;
}

// Every Babelverse account holds exactly this role; the site has no management features.
export const VISITOR_ROLE='babel-verse-visitor';

export function projectRoles(claims:Record<string,unknown>,projectId:string|undefined):string[]{
 const roles=new Set<string>();
 for(const key of ['urn:zitadel:iam:org:project:roles',projectId?`urn:zitadel:iam:org:project:${projectId}:roles`:''])
  if(key&&claims[key]&&typeof claims[key]==='object')for(const role of Object.keys(claims[key] as object))roles.add(role);
 return [...roles];
}

type Fetcher=(url:string,init:RequestInit)=>Promise<Response>;
/** Self-registered readers have no grant yet: give them the visitor role in the Babelverse project. */
export async function ensureVisitorGrant({issuer,org,projectId,userId,token,fetcher=fetch}:{issuer:string,org:string,projectId:string,userId:string,token:string,fetcher?:Fetcher}){
 if(!/^\d{1,30}$/.test(userId))throw new Error('USER_ID');
 const response=await fetcher(`${issuer}/management/v1/users/${userId}/grants`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','x-zitadel-orgid':org},body:JSON.stringify({projectId,roleKeys:[VISITOR_ROLE]})});
 // 409: a grant for this project already exists (granted concurrently or by an administrator).
 if(!response.ok&&response.status!==409)throw new Error('GRANT_'+response.status);
}
