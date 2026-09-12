const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=value=>{try{return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Los_Angeles'}).format(new Date(value))}catch{return value}};

async function getJson(url){const r=await fetch(url);if(!r.ok)throw new Error(`The server returned ${r.status}`);return r.json()}

export async function mountEvents(){
  const grid=document.querySelector('#eventsGrid'),empty=document.querySelector('#emptyState'),loading=document.querySelector('#loadingState'),error=document.querySelector('#errorState'),count=document.querySelector('#eventCount');
  const search=document.querySelector('#searchInput'),category=document.querySelector('#categorySelect'),region=document.querySelector('#regionSelect');let events=[];
  function render(){const q=search.value.trim().toLowerCase(),cat=category.value,reg=region.value;const rows=events.filter(e=>(cat==='all'||e.category===cat)&&(reg==='all'||e.region===reg)&&(!q||`${e.title} ${e.description} ${e.city} ${e.venue} ${e.source}`.toLowerCase().includes(q)));count.textContent=`${rows.length} event${rows.length===1?'':'s'}`;grid.innerHTML=rows.map(e=>`<article class="card"><div class="card-top"><span class="badge ${esc(e.category)}">${esc(e.category)}</span><span class="datebox">${esc(fmtDate(e.startsAt))}</span></div><h3>${esc(e.title)}</h3><div class="meta"><strong>${esc(e.city||e.region)}</strong><br>${esc(e.venue)}${e.description?`<br>${esc(e.description)}`:''}</div><div class="spacer"></div><div class="source-line">Source: ${esc(e.source)}</div><a class="card-link" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer sponsored">Event details / tickets →</a></article>`).join('');empty.classList.toggle('hidden',rows.length!==0)}
  for(const el of [search,category,region])el.addEventListener(el===search?'input':'change',render);
  try{const data=await getJson('/api/events?limit=250');events=data.events||[];loading.classList.add('hidden');render()}catch(e){loading.classList.add('hidden');error.textContent=`Events could not load: ${e.message}`;error.classList.remove('hidden')}
}

export async function mountStories(section){
  const grid=document.querySelector('#storyGrid'),loading=document.querySelector('#loadingState'),error=document.querySelector('#errorState'),count=document.querySelector('#storyCount');
  try{const data=await getJson(section==='music'?'/api/news':'/api/history');const rows=data.items||[];count.textContent=`${rows.length} stor${rows.length===1?'y':'ies'}`;grid.innerHTML=rows.map(x=>`<article class="story-card">${x.imageUrl?`<img src="${esc(x.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<div class="story-copy"><div class="eyebrow small">${esc(x.source)} · ${esc(fmtDate(x.publishedAt))}</div><h2>${esc(x.title)}</h2><p>${esc(x.dek||x.body||'Open the original source to read more.')}</p><a class="card-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Read at ${esc(x.source)} →</a></div></article>`).join('');loading.classList.add('hidden');if(!rows.length){grid.innerHTML='<div class="empty">No stories have been collected yet. The scheduled refresh will try again.</div>'}}
  catch(e){loading.classList.add('hidden');error.textContent=`Stories could not load: ${e.message}`;error.classList.remove('hidden')}
}

export async function mountFeaturedHistory(){
  const grid=document.querySelector('#historyFrontGrid'),loading=document.querySelector('#historyFrontLoading');if(!grid)return;
  try{const data=await getJson('/api/history?limit=3');const rows=data.items||[];grid.innerHTML=rows.map(x=>`<a class="history-teaser" href="/history"><div class="teaser-meta">${esc(x.source)} · ${esc(fmtDate(x.publishedAt))}</div><h3>${esc(x.title)}</h3>${x.dek?`<p>${esc(x.dek)}</p>`:''}</a>`).join('');loading.classList.add('hidden');if(!rows.length)grid.innerHTML='<div class="empty">The first history stories are being prepared.</div>'}
  catch{loading.textContent='The history archive is temporarily unavailable.'}
}

export async function mountSources(){
  const grid=document.querySelector('#sourceGrid');if(!grid)return;
  try{const data=await getJson('/api/sources');grid.innerHTML=(data.sources||[]).map(s=>`<div class="source-status"><strong>${esc(s.source_name)}</strong><span class="${s.last_error?'warn':'ok'}">${s.last_error?'Needs attention':`${s.last_count} found`}</span><br><small>${s.last_error?esc(s.last_error):`Last success ${esc(fmtDate(s.last_success_at))}`}</small></div>`).join('')+(!data.seatGeekConfigured?'<div class="source-status"><strong>SeatGeek</strong><span class="warn">Client ID needed</span><br><small>Add the Wrangler secret to activate it.</small></div>':'')}
  catch{grid.innerHTML='<div class="source-status"><strong>Source status</strong><span class="warn">Unavailable</span></div>'}
}
