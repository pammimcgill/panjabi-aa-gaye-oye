const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=value=>{try{return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'}).format(new Date(value))}catch{return value}};

async function getJson(url){const r=await fetch(url);if(!r.ok)throw new Error(`The server returned ${r.status}`);return r.json()}

const eventCard=e=>`<article class="card${e.imageUrl?' has-image':''}">${e.imageUrl?`<img class="card-img" src="${esc(e.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<div class="${e.imageUrl?'card-body':''}"><div class="card-top"><span class="badge ${esc(e.category)}">${esc(e.category)}</span><span class="datebox">${esc(fmtDate(e.startsAt))}</span></div><h3>${esc(e.title)}</h3><div class="meta"><strong>${esc(e.city||e.region)}</strong><br>${esc(e.venue)}${e.performers?.length?`<br>Featuring ${esc(e.performers.join(', '))}`:''}${e.description?`<br>${esc(e.description)}`:''}</div><div class="spacer"></div><div class="source-line">Source: ${esc(e.source)}</div><div class="card-actions"><a class="card-link" href="${esc(e.pageUrl)}">View event →</a><button class="quick-share" type="button" data-share-url="${esc(e.pageUrl)}" data-share-title="${esc(e.title)}">Share</button></div></div></article>`;

function wireEventGrid(grid){
  grid.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.remove()},true);
  grid.addEventListener('click',async e=>{const b=e.target.closest?.('.quick-share');if(!b)return;const data={title:b.dataset.shareTitle,text:b.dataset.shareTitle,url:new URL(b.dataset.shareUrl,location.origin).href};if(navigator.share){try{await navigator.share(data);return}catch(error){if(error.name==='AbortError')return}}try{await navigator.clipboard.writeText(data.url);const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1600)}catch{location.href=b.dataset.shareUrl}});
}

export async function mountEvents(){
  const grid=document.querySelector('#eventsGrid'),empty=document.querySelector('#emptyState'),loading=document.querySelector('#loadingState'),error=document.querySelector('#errorState'),count=document.querySelector('#eventCount');
  const search=document.querySelector('#searchInput'),category=document.querySelector('#categorySelect'),region=document.querySelector('#regionSelect');let events=[];
  function render(){const q=search.value.trim().toLowerCase(),cat=category.value,reg=region.value;const rows=events.filter(e=>(cat==='all'||e.category===cat)&&(reg==='all'||e.region===reg)&&(!q||`${e.title} ${e.description} ${e.city} ${e.venue} ${e.source} ${(e.performers||[]).join(' ')}`.toLowerCase().includes(q)));count.textContent=`${rows.length} event${rows.length===1?'':'s'}`;grid.innerHTML=rows.map(eventCard).join('');empty.classList.toggle('hidden',rows.length!==0)}
  for(const el of [search,category,region])el.addEventListener(el===search?'input':'change',render);
  wireEventGrid(grid);
  try{const data=await getJson('/api/events?limit=250');events=data.events||[];loading.classList.add('hidden');render()}catch(e){loading.classList.add('hidden');error.textContent=`Events could not load: ${e.message}`;error.classList.remove('hidden')}
}

export async function mountWeekend(){
  const grid=document.querySelector('#eventsGrid'),empty=document.querySelector('#emptyState'),loading=document.querySelector('#loadingState'),error=document.querySelector('#errorState'),count=document.querySelector('#eventCount'),chips=document.querySelector('#weekendRegion'),range=document.querySelector('#weekendRange');let events=[],region='all';
  const render=()=>{const rows=events.filter(e=>region==='all'||e.region===region);count.textContent=`${rows.length} event${rows.length===1?'':'s'}`;grid.innerHTML=rows.map(eventCard).join('');empty.classList.toggle('hidden',rows.length!==0);chips.querySelectorAll('.chip').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.region===region)))};
  chips.addEventListener('click',e=>{const b=e.target.closest?.('.chip');if(!b)return;region=b.dataset.region;render()});wireEventGrid(grid);
  try{const data=await getJson('/api/events?when=weekend&limit=250');events=data.events||[];if(data.range)range.textContent=data.range;loading.classList.add('hidden');render()}catch(e){loading.classList.add('hidden');error.textContent=`Weekend events could not load: ${e.message}`;error.classList.remove('hidden')}
}

export async function mountArchive(){
  const grid=document.querySelector('#eventsGrid'),empty=document.querySelector('#emptyState'),loading=document.querySelector('#loadingState'),error=document.querySelector('#errorState'),count=document.querySelector('#eventCount'),search=document.querySelector('#archiveSearch'),more=document.querySelector('#loadMore');let events=[],shown=24;
  const render=()=>{const q=search.value.trim().toLowerCase();const rows=events.filter(e=>!q||`${e.title} ${e.city} ${e.venue} ${(e.performers||[]).join(' ')} ${new Date(e.startsAt).getFullYear()}`.toLowerCase().includes(q));count.textContent=`${rows.length} past event${rows.length===1?'':'s'}`;grid.innerHTML=rows.slice(0,shown).map(eventCard).join('');empty.classList.toggle('hidden',rows.length!==0);more.classList.toggle('hidden',rows.length<=shown)};
  search.addEventListener('input',()=>{shown=24;render()});more.addEventListener('click',()=>{shown+=24;render()});wireEventGrid(grid);
  try{const data=await getJson('/api/events?past=1&limit=250');events=data.events||[];loading.classList.add('hidden');render()}catch(e){loading.classList.add('hidden');error.textContent=`Past events could not load: ${e.message}`;error.classList.remove('hidden')}
}

export async function mountTravel(){
  const grid=document.querySelector('#travelGrid'),sources=document.querySelector('#travelSources'),loading=document.querySelector('#loadingState'),error=document.querySelector('#errorState'),updated=document.querySelector('#travelUpdated');
  try{const data=await getJson('/api/travel');sources.innerHTML=(data.sources||[]).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a>`).join('');grid.innerHTML=(data.items||[]).map(x=>`<article class="travel-card ${x.severity==='major'?'major':''}"><div class="eyebrow small">${esc(x.source)} · ${esc(x.severity||'notice')}</div><h2>${esc(x.title)}</h2>${x.road?`<strong>${esc(x.road)}</strong>`:''}<p>${esc(x.description)}</p>${x.url?`<a class="card-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Open official advisory ↗</a>`:''}</article>`).join('')||'<div class="empty">No corridor advisories were returned. Check the official maps above before leaving.</div>';updated.textContent=`Updated ${fmtDate(data.generatedAt)}`;loading.classList.add('hidden');if(data.errors?.length){error.textContent=data.errors.join(' · ');error.classList.remove('hidden')}}catch(e){loading.classList.add('hidden');error.textContent=`Travel information could not load: ${e.message}`;error.classList.remove('hidden')}
}

const timeAgo=value=>{const ms=Date.now()-new Date(value).getTime();if(!(ms>=0))return fmtDate(value);const h=Math.floor(ms/3600000);if(h<1)return'Just now';if(h<24)return`${h}h ago`;const d=Math.floor(h/24);return d<7?`${d}d ago`:fmtDate(value)};

export async function mountStories(section){
  const $=q=>document.querySelector(q);
  const grid=$('#storyGrid'),loading=$('#loadingState'),error=$('#errorState'),count=$('#storyCount'),tools=$('#storyTools'),more=$('#loadMore');
  const isNews=section==='music',PAGE=12,state={items:[],q:'',chip:'',shown:PAGE,chips:[],sort:'newest'};
  const matches=x=>{
    if(state.chip&&!(isNews?x.source===state.chip:(x.topics||[]).includes(state.chip)))return false;
    const q=state.q.trim().toLowerCase();
    return !q||`${x.title} ${x.dek} ${x.source} ${(x.topics||[]).join(' ')} ${x.year||''}`.toLowerCase().includes(q);
  };
  const chapterOf=x=>x.chapterNumber??(x.internal?99:100);
  const chapterLabel=x=>({name:x.chapter||(x.internal?'Culture and heritage':'Further reading'),span:x.chapterSpan||(x.internal?'Music, food, language and festivals':'Archives, scholars and institutions')});
  const byTimeline=(a,b)=>chapterOf(a)-chapterOf(b)||(a.year||9999)-(b.year||9999)||new Date(b.publishedAt)-new Date(a.publishedAt);
  const card=(x,lead)=>{
    const own=Boolean(x.internal);
    const meta=isNews?`${esc(x.source)} · ${esc(timeAgo(x.publishedAt))}`:own?`${x.year?`<strong class="year">${esc(x.year)}</strong> · `:''}Our article · ${esc(x.minutes||1)} min read`:`${esc(x.source)} · Reading link`;
    const pills=(x.topics||[]).map(t=>`<span class="pill">${esc(t)}</span>`).join('');
    const link=own?`<a class="card-link" href="${esc(x.url)}">Read the article →</a>`:`<a class="card-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Read at ${esc(x.source)} →</a>`;
    return `<article class="story-card${lead?' lead':''}${own?' own':''}">${x.imageUrl?`<img src="${esc(x.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<div class="story-copy"><div class="eyebrow small">${meta}</div><h2>${esc(x.title)}</h2>${pills?`<div class="pills">${pills}</div>`:''}<p>${esc(x.dek||'Open the original source to read more.')}</p>${link}</div></article>`;
  };
  const render=()=>{
    const timeline=!isNews&&state.sort==='timeline';
    const rows=state.items.filter(matches);if(timeline)rows.sort(byTimeline);
    const visible=rows.slice(0,state.shown);
    const lead=!timeline&&!state.q&&!state.chip&&rows.length>=4;
    count.textContent=`${rows.length} stor${rows.length===1?'y':'ies'}`;
    let last=null;
    grid.innerHTML=visible.length?visible.map((x,i)=>{
      let head='';
      if(timeline&&chapterOf(x)!==last){last=chapterOf(x);const c=chapterLabel(x);head=`<div class="chapter-head"><span>${last<99?`Chapter ${last}`:'Beyond the timeline'}</span><h3>${esc(c.name)}</h3><small>${esc(c.span)}</small></div>`}
      return head+card(x,lead&&i===0);
    }).join(''):`<div class="empty">${state.items.length?'No stories match that search.':isNews?'No stories have been collected yet. The scheduled refresh will try again.':'The first chapters of the story are being prepared.'}</div>`;
    if(more)more.classList.toggle('hidden',rows.length<=state.shown);
    if(tools){
      tools.querySelectorAll('.chip').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.chip||'')===state.chip)));
      tools.querySelectorAll('.sort').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sort===state.sort)));
    }
  };
  try{
    const data=await getJson(isNews?'/api/news':'/api/history');
    state.items=data.items||[];
    state.chips=(isNews?data.sources:data.topics)||[];
    const dated=state.items.filter(x=>x.year).length;
    if(!isNews&&dated>=2)state.sort='timeline';
    if(tools&&state.items.length>3){
      const sorter=!isNews&&dated>=2?`<div class="chips sorter" role="group" aria-label="Order"><button class="chip sort" type="button" data-sort="timeline" aria-pressed="true">The story so far</button><button class="chip sort" type="button" data-sort="newest" aria-pressed="false">Newest first</button></div>`:'';
      tools.innerHTML=`${sorter}<input class="story-search" type="search" placeholder="${isNews?'Search headlines or artists':'Search the archive'}" aria-label="Search stories">${state.chips.length>1?`<div class="chips" role="group" aria-label="${isNews?'Filter by source':'Filter by topic'}"><button class="chip" type="button" data-chip="" aria-pressed="true">All</button>${state.chips.map(c=>`<button class="chip" type="button" data-chip="${esc(c.name)}" aria-pressed="false">${esc(c.name)} <span>${esc(c.count)}</span></button>`).join('')}</div>`:''}`;
      tools.addEventListener('input',e=>{if(e.target.classList.contains('story-search')){state.q=e.target.value;state.shown=PAGE;render()}});
      tools.addEventListener('click',e=>{
        const s=e.target.closest?.('.sort');if(s){state.sort=s.dataset.sort;state.shown=PAGE;render();return}
        const b=e.target.closest?.('.chip');if(b){state.chip=b.dataset.chip||'';state.shown=PAGE;render()}
      });
    }
    if(more)more.addEventListener('click',()=>{state.shown+=PAGE;render()});
    grid.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.remove()},true);
    loading.classList.add('hidden');render();
  }
  catch(e){loading.classList.add('hidden');error.textContent=`Stories could not load: ${e.message}`;error.classList.remove('hidden')}
}

export async function mountFeaturedHistory(){
  const grid=document.querySelector('#historyFrontGrid'),loading=document.querySelector('#historyFrontLoading');if(!grid)return;
  try{const data=await getJson('/api/history?limit=3');const rows=data.items||[];grid.innerHTML=rows.map(x=>`<a class="history-teaser" href="${esc(x.internal?x.url:'/history')}"><div class="teaser-meta">${x.year?`${esc(x.year)} · `:''}${esc(x.source)}</div><h3>${esc(x.title)}</h3>${x.dek?`<p>${esc(x.dek)}</p>`:''}</a>`).join('');loading.classList.add('hidden');if(!rows.length)grid.innerHTML='<div class="empty">The first history stories are being prepared.</div>'}
  catch{loading.textContent='The history archive is temporarily unavailable.'}
}

export async function mountSources(){
  const grid=document.querySelector('#sourceGrid');if(!grid)return;
  const summary=document.querySelector('#sourceSummary'),retired=document.querySelector('#sourceRetired');
  const cls={ok:'ok',error:'warn',setup:'warn',empty:'note',filtered:'note'};
  try{
    const data=await getJson('/api/sources');const rows=data.sources||[];
    const good=rows.filter(s=>s.state==='ok').length;
    if(summary)summary.textContent=`${good} of ${rows.length} sources are working. ${rows.length-good?`${rows.length-good} need a look.`:'Everything is running.'}`;
    grid.innerHTML=rows.map(s=>`<div class="source-status"><strong>${esc(s.source_name)}</strong><span class="${cls[s.state]||'ok'}">${esc(s.label||`${s.last_count} found`)}</span><br><small>${esc(s.detail||'')}${s.last_success_at?`${s.detail?' · ':''}Last success ${esc(fmtDate(s.last_success_at))}`:''}</small></div>`).join('');
    if(retired&&(data.retired||[]).length)retired.textContent=`Not collected in this version: ${data.retired.map(x=>x.source_name).join(', ')}.`;
  }
  catch{grid.innerHTML='<div class="source-status"><strong>Source status</strong><span class="warn">Unavailable</span></div>'}
}
