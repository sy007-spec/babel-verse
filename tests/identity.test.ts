import {test} from 'node:test';
import assert from 'node:assert/strict';
import {organizationMatches,isolatedSession} from '../lib/identity';
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
