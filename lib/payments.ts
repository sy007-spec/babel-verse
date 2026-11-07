import {randomUUID} from 'node:crypto';
import {db} from './db';
import {normalizeSearch,safeLanguage} from './rules';
import {alipay,paymentCall} from './alipay';
import {amountInCents,workDraft} from './payment-rules';
// Called only after provider signature and merchant/order fields are verified.
export async function settlePayment(id:string,trade:string){const c=await db.connect();try{await c.query('BEGIN');const o=(await c.query('SELECT * FROM payment_orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!o)throw Error('ORDER_NOT_FOUND');if(o.trade_no&&o.trade_no!==trade)throw Error('TRADE_CONFLICT');if(o.state!=='created'){await c.query('COMMIT');return;}
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[o.fingerprint]);const exists=await c.query('SELECT id FROM works WHERE fingerprint=$1',[o.fingerprint]);
 if(exists.rowCount){await c.query("UPDATE payment_orders SET state='refund_pending',trade_no=$2,paid_at=now() WHERE id=$1",[id,trade]);}
 else{const w=workDraft.parse(o.draft),wid=randomUUID();await c.query("INSERT INTO works(id,author_id,title,poet,language,body,fingerprint,source_url,citation,rights,period,genre,search_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",[wid,o.author_id,w.title,w.poet,safeLanguage(w.language),w.body,o.fingerprint,w.source_url,w.citation,w.rights,w.period,w.genre,normalizeSearch(w.title+' '+w.poet+' '+w.body)]);await c.query("INSERT INTO jobs(id,kind,target) VALUES($1,'work',$2)",[randomUUID(),wid]);await c.query("UPDATE payment_orders SET state='paid',trade_no=$2,work_id=$3,paid_at=now() WHERE id=$1",[id,trade,wid]);}
 await c.query("INSERT INTO audit(actor,action,target,reason) VALUES('alipay','payment-settled',$1,'Verified CNY 0.10')",[id]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function reconcileOrder(id:string,provider?:{config:{appId:string,sellerId:string},call:typeof paymentCall}){const {config,call}=provider||{config:alipay().config,call:paymentCall};const o=(await db.query('SELECT * FROM payment_orders WHERE id=$1',[id])).rows[0];if(!o||o.app_id!==config.appId||o.seller_id!==config.sellerId)return;
 await db.query('UPDATE payment_orders SET checked_at=now() WHERE id=$1',[id]);
 if(o.state==='created'){
  const r=await call('alipay.trade.query',{outTradeNo:id});
  if(r.code==='10000'){
   if(r.outTradeNo!==id||amountInCents(r.totalAmount)!==10)throw Error('ORDER_MISMATCH');
   if(['TRADE_SUCCESS','TRADE_FINISHED'].includes(r.tradeStatus)){if(!/^\d{10,64}$/.test(r.tradeNo))throw Error('TRADE_INVALID');await settlePayment(id,r.tradeNo);}
   else if(r.tradeStatus==='TRADE_CLOSED')await db.query("UPDATE payment_orders SET state='closed' WHERE id=$1 AND state='created'",[id]);
   else if(Date.now()-new Date(o.created_at).getTime()>3600000){const closed=await call('alipay.trade.close',{outTradeNo:id});if(closed.code==='10000')await db.query("UPDATE payment_orders SET state='closed' WHERE id=$1 AND state='created'",[id]);}
  }
 }else if(o.state==='refund_pending'){
  const r=await call('alipay.trade.refund',{outTradeNo:id,tradeNo:o.trade_no,refundAmount:'0.10',outRequestNo:'refund_'+id,refundReason:'Poem submission not accepted'});
  if(r.code!=='10000'||r.outTradeNo!==id||r.tradeNo!==o.trade_no||amountInCents(r.refundFee)!==10)throw Error('REFUND_UNCONFIRMED');
  await db.query("UPDATE payment_orders SET state='refunded',refunded_at=now() WHERE id=$1 AND state='refund_pending'",[id]);
  await db.query("INSERT INTO audit(actor,action,target,reason) VALUES('alipay','refund-confirmed',$1,'Verified CNY 0.10 refund')",[id]);
 }
}
export async function reconcilePayments(){
 await db.query("UPDATE payment_orders o SET state='refund_pending' FROM works w WHERE o.work_id=w.id AND o.state='paid' AND (w.status IN('review','private') OR (w.status='pending' AND o.paid_at<now()-interval '24 hours'))");
 const orders=await db.query("SELECT id FROM payment_orders WHERE state IN('created','refund_pending') AND (checked_at IS NULL OR checked_at<now()-interval '60 seconds') ORDER BY checked_at NULLS FIRST LIMIT 30");
 for(const o of orders.rows)try{await reconcileOrder(o.id);}catch{console.error('Payment reconciliation deferred',o.id);}
}
