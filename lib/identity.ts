export function organizationMatches(claims:Record<string,unknown>,org:string|undefined){
 return !!org&&claims['urn:zitadel:iam:user:resourceowner:id']===org;
}
export function isolatedSession<T extends {org?:string}>(session:T,org:string|undefined):T|null{return org&&session.org===org?session:null;}
