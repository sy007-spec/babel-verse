import {headers} from 'next/headers';
import * as maxmind from 'maxmind';
export const dynamic='force-dynamic';
const regions:Record<string,string>={CN:'zh-Hans',TW:'zh-Hans',HK:'zh-Hans',JP:'ja',FR:'fr',ES:'es',MX:'es',AR:'es',SA:'ar',EG:'ar',AE:'ar',GB:'en',US:'en',AU:'en'};
export async function GET(){const h=await headers();let lang='en',country='';try{if(process.env.GEOIP_DATABASE){const r=await maxmind.open<maxmind.CountryResponse>(process.env.GEOIP_DATABASE);country=r.get(h.get('x-real-ip')||'')?.country?.iso_code||'';lang=regions[country]||'en';}}catch{}const browser=(h.get('accept-language')||'').split(',')[0].split('-')[0];if(!country||['CA','BE','CH','SG'].includes(country))lang=({zh:'zh-Hans',en:'en',fr:'fr',es:'es',ja:'ja',ar:'ar'} as Record<string,string>)[browser]||lang;return Response.json({locale:lang,language:lang,geoip:!!country},{headers:{'Cache-Control':'private, no-store','Vary':'Accept-Language'}});}
