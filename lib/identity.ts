export function organizationMatches(claims:Record<string,unknown>,org:string|undefined){
 return !!org&&claims['urn:zitadel:iam:user:resourceowner:id']===org;
}
export function isolatedSession<T extends {org?:string}>(session:T,org:string|undefined):T|null{return org&&session.org===org?session:null;}

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
