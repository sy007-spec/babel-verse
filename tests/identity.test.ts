import {test} from 'node:test';
import assert from 'node:assert/strict';
import {organizationMatches,organizationOf,signInOrganizations,isolatedSession,projectRoles,ensureVisitorGrant,VISITOR_ROLE} from '../lib/identity';
import {supportedLanguage} from '../lib/languages';
test('missing or foreign organization cannot authenticate',()=>{
 assert.equal(organizationMatches({},'babelverse'),false);
 assert.equal(organizationMatches({'urn:zitadel:iam:user:resourceowner:id':'other'},'babelverse'),false);
 assert.equal(organizationMatches({'urn:zitadel:iam:user:resourceowner:id':'babelverse'},'babelverse'),true);
 assert.equal(organizationMatches({},undefined),false);
});
test('old unscoped sessions and foreign sessions are invalid',()=>{
 assert.equal(isolatedSession({org:undefined},'babelverse'),null);
 assert.equal(isolatedSession({org:'other'},'babelverse'),null);
 assert.deepEqual(isolatedSession({org:'babelverse'},'babelverse'),{org:'babelverse'});
});
test('removed language preferences fall back and new languages remain available',()=>{
 assert.equal(supportedLanguage('ja'),'en');
 for(const id of ['pt','de','it'])assert.equal(supportedLanguage(id),id);
});
test('project roles come from either ZITADEL role claim',()=>{
 assert.deepEqual(projectRoles({},'p1'),[]);
 assert.deepEqual(projectRoles({'urn:zitadel:iam:org:project:roles':{[VISITOR_ROLE]:{o:'org'}}},'p1'),[VISITOR_ROLE]);
 assert.deepEqual(projectRoles({'urn:zitadel:iam:org:project:p1:roles':{[VISITOR_ROLE]:{}}},'p1'),[VISITOR_ROLE]);
});
test('visitor grant asks only for the visitor role in the Babelverse org',async()=>{
 const calls:{url:string,init:RequestInit}[]=[];
 const ok=async(url:string,init:RequestInit)=>{calls.push({url,init});return new Response('{}',{status:200})};
 await ensureVisitorGrant({issuer:'https://id.example',org:'o1',projectId:'p1',userId:'123',token:'t',fetcher:ok});
 assert.equal(calls[0].url,'https://id.example/management/v1/users/123/grants');
 assert.deepEqual(JSON.parse(String(calls[0].init.body)),{projectId:'p1',roleKeys:[VISITOR_ROLE]});
 assert.equal((calls[0].init.headers as Record<string,string>)['x-zitadel-orgid'],'o1');
 await ensureVisitorGrant({issuer:'https://id.example',org:'o1',projectId:'p1',userId:'123',token:'t',fetcher:async()=>new Response('',{status:409})});
 await assert.rejects(ensureVisitorGrant({issuer:'https://id.example',org:'o1',projectId:'p1',userId:'123',token:'t',fetcher:async()=>new Response('',{status:403})}),/GRANT_403/);
 await assert.rejects(ensureVisitorGrant({issuer:'https://id.example',org:'o1',projectId:'p1',userId:'../x',token:'t',fetcher:ok}),/USER_ID/);
});
test('Babelverse readers and SEII main-org accounts can both sign in; others cannot',()=>{
 const orgs=signInOrganizations('398717321167765507',' 395379424805060611 ,bad,');
 assert.deepEqual(orgs,['398717321167765507','395379424805060611']);
 assert.deepEqual(signInOrganizations('1',undefined),['1']);
 assert.equal(organizationOf({'urn:zitadel:iam:user:resourceowner:id':'395379424805060611'},orgs),'395379424805060611');
 assert.equal(organizationOf({'urn:zitadel:iam:user:resourceowner:id':'398717321167765507'},orgs),'398717321167765507');
 assert.equal(organizationOf({'urn:zitadel:iam:user:resourceowner:id':'999'},orgs),null);
 assert.equal(organizationOf({},orgs),null);
 assert.deepEqual(isolatedSession({org:'395379424805060611'},orgs),{org:'395379424805060611'});
 assert.equal(isolatedSession({org:'999'},orgs),null);
 assert.equal(isolatedSession({org:undefined},orgs),null);
});
