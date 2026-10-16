import {scanBatch,scanView} from './artist-scanner.js';
export default {
 async scheduled(controller,env,ctx){ctx.waitUntil(scanBatch(env));},
 async fetch(request,env){const url=new URL(request.url);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(url.pathname==='/api/events'){const configured=Boolean(env.ARTIST_SCAN&&env.TICKETMASTER_API_KEY);const state=configured?await env.ARTIST_SCAN.get('state','json'):null;const data=scanView(state);if(!configured)data.scan.state='not_configured';return Response.json(data,{headers:{'cache-control':'public,max-age=60'}});}
 if(url.pathname==='/')url.pathname='/artists';url.search='';return env.ASSETS.fetch(new Request(url,request));}
};
