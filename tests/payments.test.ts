import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {AlipaySdk} from 'alipay-sdk';
import {amountInCents,validNotification} from '../lib/payment-rules';
const n={app_id:'123',seller_id:'2088123',total_amount:'0.10',out_trade_no:'a'.repeat(32),trade_no:'202611071234567890',trade_status:'TRADE_SUCCESS',sign_type:'RSA2'};
test('money uses integer cents and rejects float tricks',()=>{assert.equal(amountInCents('0.10'),10);assert.equal(amountInCents('0.1'),10);for(const v of ['0.10001','1e-1','-0.10','NaN',0.1])assert.equal(amountInCents(v),-1);});
test('wrong merchant, application, amount, status or order cannot settle',()=>{
 assert.equal(validNotification(n,'123','2088123'),true);
 for(const [key,value]of Object.entries({app_id:'other',seller_id:'other',total_amount:'0.01',trade_status:'WAIT_BUYER_PAY',sign_type:'RSA',out_trade_no:'../id',trade_no:'bad'}))assert.equal(validNotification({...n,[key]:value},'123','2088123'),false);
});
test('official SDK rejects forged or modified payment notifications',()=>{
 const key=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const sdk=new AlipaySdk({appId:'123',privateKey:key.privateKey,keyType:'PKCS8',alipayPublicKey:key.publicKey});
 const canonical=Object.keys(n).filter(k=>k!=='sign_type').sort().map(k=>k+'='+n[k as keyof typeof n]).join('&');
 const signed={...n,sign:sign('RSA-SHA256',Buffer.from(canonical),key.privateKey).toString('base64')};
 assert.equal(sdk.checkNotifySignV2(signed),true);assert.equal(sdk.checkNotifySignV2({...signed,total_amount:'0.01'}),false);assert.equal(sdk.checkNotifySignV2({...signed,sign:'forged'}),false);
});
