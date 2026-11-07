import {z} from 'zod';
export const resultSchema=z.object({action:z.enum(['allow','private','review']),reason:z.enum(['ok','incivility','uncertain','unverified','incomplete','irrelevant']),complete:z.boolean(),traceable:z.boolean(),appropriate:z.boolean()});
export function disposition(kind:string,result:unknown,evidence:boolean){const v=resultSchema.parse(result);if(kind==='work'&&(!evidence||!v.complete||!v.traceable))return 'review';if(kind==='tag'&&!v.appropriate)return 'review';return v.action==='allow'?'published':v.action==='private'?'private':'review';}
