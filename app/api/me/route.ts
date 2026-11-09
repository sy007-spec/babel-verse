import {actor,device} from '../../../lib/security';
import {accountSection} from '../../../lib/account';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(){await device();const a=await actor();if(!a)return Response.json({user:null,login:!!process.env.OIDC_CLIENT_ID},{headers});
 // Profile, password and passkeys are self-managed at the identity provider; this site stores no email or password.
 const issuer=process.env.OIDC_ISSUER,kind=a.org&&a.org===process.env.OIDC_ORG_ID?'reader':'seii';
 let summary=null;try{summary=await accountSection(a.id,'summary');}catch{}
 return Response.json({user:{id:a.id,name:a.name},account:{kind,manage_url:issuer?issuer.replace(/\/$/,'')+'/ui/console/users/me':null},summary},{headers});}
