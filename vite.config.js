import { defineConfig } from 'vite';

const events = [
  {id:'1',title:'Fake Shaadi — Bollywood & Punjabi Night',description:'Bollywood, Punjabi and South Indian hits with live dhol.',category:'nightlife',region:'Seattle',city:'Seattle',venue:'Ora Nightclub',startsAt:'2026-09-12T21:00:00-07:00',url:'#',source:'Ora Seattle'},
  {id:'2',title:'Regular Sunday Program',description:'Asa Ki Vaar, Kirtan, community program and Langar.',category:'religious',region:'Seattle',city:'Renton',venue:'Gurdwara Singh Sabha of Washington',startsAt:'2026-09-13T09:00:00-07:00',url:'#',source:'GSSWA'},
  {id:'3',title:'Sonu Nigam — Revolution Tour',description:'Live in concert at accesso ShoWare Center.',category:'concert',region:'Seattle',city:'Kent',venue:'accesso ShoWare Center',startsAt:'2026-09-19T19:30:00-07:00',url:'#',source:'Ticketmaster'},
  {id:'4',title:'Shreya Ghoshal — The Unstoppable Tour',description:'Shreya Ghoshal live in the Pacific Northwest.',category:'concert',region:'Seattle',city:'Everett',venue:'Angel Of The Winds Arena',startsAt:'2026-09-24T19:30:00-07:00',url:'#',source:'Venue calendar'},
  {id:'5',title:'Family Youth Kirtan Darbar',description:'Recurring Sunday family and youth Kirtan program.',category:'religious',region:'Vancouver',city:'Surrey',venue:'Guru Nanak Sikh Gurdwara',startsAt:'2026-09-27T11:00:00-07:00',url:'#',source:'GNSG'},
  {id:'6',title:'Mehfil — Live Punjabi Music',description:'A Punjabi music night at the Hard Rock Casino.',category:'concert',region:'Vancouver',city:'Coquitlam',venue:'Hard Rock Casino Vancouver',startsAt:'2026-10-11T19:00:00-07:00',url:'#',source:'Venue calendar'}
];

const history = [
  {id:'history-1',title:'The Sikh soldiers who crossed oceans',dek:'Letters, photographs and service records connect Panjab with the world wars and the Pacific Northwest diaspora.',url:'#',source:'Panjab Digital Library',author:'Editorial desk',publishedAt:'2026-09-09T12:00:00Z'},
  {id:'history-2',title:'1947: Panjab, Partition and a divided homeland',dek:'A source-backed starting point for understanding how Partition reshaped Panjab and its communities.',url:'#',source:'Sikh Research Institute',author:'Editorial desk',publishedAt:'2026-09-06T12:00:00Z'},
  {id:'history-3',title:'Panjabi migration to the Pacific Northwest',dek:'The mills, farms and gurdwaras that shaped early community life in Washington and British Columbia.',url:'#',source:'Community archive',author:'Editorial desk',publishedAt:'2026-09-02T12:00:00Z'}
];

function json(res,data){res.statusCode=200;res.setHeader('content-type','application/json');res.end(JSON.stringify(data));}

export default defineConfig({
  server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
  plugins:[{
    name:'panjabi-preview-api',
    configureServer(server){
      server.middlewares.use((req,res,next)=>{
        if(req.url?.startsWith('/api/events')) return json(res,{events,generatedAt:new Date().toISOString()});
        if(req.url?.startsWith('/api/history')) return json(res,{items:history,githubEnabled:true,generatedAt:new Date().toISOString()});
        if(req.url?.startsWith('/api/sources')) return json(res,{seatGeekConfigured:false,sources:[
          {source_name:'Seattle Theatre Group',last_count:12,last_success_at:'2026-09-11T12:00:00Z',last_error:null},
          {source_name:'Gurdwara sources',last_count:8,last_success_at:'2026-09-11T12:00:00Z',last_error:null},
          {source_name:'Vancouver theatres',last_count:15,last_success_at:'2026-09-11T12:00:00Z',last_error:null}
        ]});
        next();
      });
    }
  }]
});
