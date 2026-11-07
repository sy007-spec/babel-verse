import {db} from '../../../../lib/db';
import {alipay} from '../../../../lib/alipay';
import {validNotification} from '../../../../lib/payment-rules';
import {settlePayment} from '../../../../lib/payments';
export async function POST(req:Request){try{
 const reader=req.body?.getReader();if(!reader)throw Error();const chunks=[];let size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>32768){await reader.cancel();throw Error();}chunks.push(r.value);}
 const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));if([...params.keys()].length!==new Set(params.keys()).size)throw Error();const n=Object.fromEntries(params),{sdk,config}=alipay();
 if(!sdk.checkNotifySignV2(n)||!validNotification(n,config.appId,config.sellerId))throw Error();
 const o=(await db.query('SELECT app_id,seller_id FROM payment_orders WHERE id=$1',[n.out_trade_no])).rows[0];if(!o||o.app_id!==n.app_id||o.seller_id!==n.seller_id)throw Error();
 await settlePayment(n.out_trade_no,n.trade_no);return new Response('success');
 }catch{return new Response('failure',{status:400});}}
