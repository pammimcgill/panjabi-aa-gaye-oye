// ---------------------------------------------------------------------------
// Identity terms
// ---------------------------------------------------------------------------
// An event is kept when its TITLE (or a named performer) contains one of EVENT_TERMS.
// DESCRIPTION_TERMS are the stronger cultural words that are also trusted when they
// appear in the event's own description. Matching is whole-word and Unicode-aware,
// so Gurmukhi and Devanagari text works.

const CULTURAL_TERMS = [
  // Punjabi / Sikh culture
  'punjabi','panjabi','punjab','panjab','bhangra','giddha','sikh','sikhs','sikhi','gurdwara','gurudwara',
  'kirtan','gurbani','gurpurab','gurpurb','khalsa','vaisakhi','baisakhi','nagar kirtan','akhand path',
  'sehaj path','shabad','naam simran','jashan','lohri','teeyan','hola mohalla','bandi chhor','shaheedi',
  'guru nanak','guru gobind singh','guru granth sahib','dhol','mehfil','qawwali','sufi','ghazal',
  // Wider South Asian culture
  'bollywood','desi','south asian','india day','lights of india','hindi','urdu','diwali','holi','hindustani',
  'carnatic','mela','garba','dandiya','sangeet',
  // Gurmukhi / Devanagari
  'ਪੰਜਾਬੀ','ਪੰਜਾਬ','ਭੰਗੜਾ','ਗਿੱਧਾ','ਸਿੱਖ','ਗੁਰਦੁਆਰਾ','ਕੀਰਤਨ','ਗੁਰਬਾਣੀ','ਗੁਰਪੁਰਬ','ਖਾਲਸਾ','ਵਿਸਾਖੀ','ਨਗਰ ਕੀਰਤਨ','ਸ਼ਬਦ','ਲੋਹੜੀ',
  'पंजाबी','भांगड़ा','बॉलीवुड','दिवाली'
];

// Words that are safe to trust when found in an event's own description.
export const DESCRIPTION_TERMS = [
  'punjabi','panjabi','punjab','panjab','bhangra','giddha','sikh','sikhs','sikhi','gurdwara','gurudwara',
  'kirtan','gurbani','gurpurab','gurpurb','khalsa','vaisakhi','baisakhi','nagar kirtan','akhand path',
  'sehaj path','naam simran','jashan','lohri','hola mohalla','bollywood',
  'ਪੰਜਾਬੀ','ਪੰਜਾਬ','ਭੰਗੜਾ','ਸਿੱਖ','ਗੁਰਦੁਆਰਾ','ਕੀਰਤਨ','ਗੁਰਬਾਣੀ','ਗੁਰਪੁਰਬ','ਵਿਸਾਖੀ','पंजाबी'
];

export const COMEDIAN_TERMS = [
  'kapil sharma','vir das','zakir khan','hasan minhaj','russell peters','zarna garg','akaash singh',
  'kanan gill','abhishek upmanyu','anubhav singh bassi','gaurav kapoor','samay raina','munawar faruqui',
  'harsh gujral','jaspreet singh','gurleen pannu','aakash gupta','rahul subramanian','rahul dua','aditi mittal'
];

// Performers. Add names here as you spot events that were missed.
export const ARTIST_TERMS = [
  'diljit','diljit dosanjh','karan aujla','gurdas maan','satinder sartaaj','ap dhillon','babbu maan','ammy virk',
  'sidhu','sidhu moose wala','jass','gippy grewal','guru randhawa','shreya ghoshal','sonu nigam','atif aslam',
  'rahat fateh ali khan','nusrat fateh ali khan','arijit singh','shubh','amrinder gill','jasmine sandlas',
  'nimrat khaira','harbhajan mann','honey singh','badshah','neha kakkar','mika singh','daler mehndi',
  'sunanda sharma','prabh gill','kulwinder billa','gurnam bhullar','jordan sandhu','mankirt aulakh',
  'sajjan adeeb','hans raj hans','malkit singh','sukhshinder shinda','gur sidhu','a r rahman','ar rahman',
  'jubin nautiyal','darshan raval','sunidhi chauhan','armaan malik','b praak','jassie gill','ranjit bawa',
  'jazzy b','sharry maan','kuldeep manak','ali sethi','sonu nigam',
  // South Asian comedians (also searched on Ticketmaster, see COMEDIAN_TERMS)
  ...COMEDIAN_TERMS,
  // Seattle desi / Bollywood DJs
  'dj sats','dj prashant','dj tejas','dj aanshul','dj tamm'
];

const EXTRA_PHRASES = [
  'desi comedy','indian comedy','punjabi comedy','desi night','desi nights','brown munde','shaadi night',
  'bollywood dj','punjabi dj'
];

export const EVENT_TERMS = [...new Set([...CULTURAL_TERMS, ...ARTIST_TERMS, ...EXTRA_PHRASES])];

export const EVENT_PRODUCT_NOISE = [
  'amplified access','not an event ticket','parking pass','reserved parking','event parking','parking only',
  'vip parking','premium parking','preferred parking','general parking','lot pass',
  'vip club','club access','lounge access','fast lane','early entry','early access',
  'vip package','vip packages','vip upgrade','vip experience','vip ticket','vip tickets',
  'official platinum','platinum package','platinum seats','platinum seating',
  'club level','club seats','club seating','suite rental','suite package','private suite','loge box',
  'premium seating','premium package','premium experience','ultimate package','fan package','hospitality package',
  'travel package','hotel package','pit package','soundcheck','sound check experience',
  'u first experience','u-first experience','meet and greet','meet greet',
  'merch package','souvenir ticket','ticket insurance'
];

export const KNOWN_EVENT_FALSE_POSITIVES = [
  'school of rock','burleskaraoke','clock out lounge presents tush'
];

// Titles like "Indian Gaming Conference", "Indian Scout Demo Day" or "Indian Days Powwow" are not
// South Asian events. Bare "Indian" also needs a cultural word next to it (see INDIAN_CONTEXT_TERMS).
export const AMBIGUOUS_INDIAN_PHRASES = [
  'american indian','american indians','native indian','indian motorcycle','indian scout','indian chief',
  'indian gaming','indian casino','indian country','indian health','indian reservation','indian tribe',
  'indian tribes','indian territory','indian days','indian wells','indian creek','indian head','indian river',
  'indian springs','indian trail','indian hills','indian hill','indian lake','indian island','indian point',
  'indian summer','powwow','pow wow','daybreak star','united indians'
];

export const INDIAN_CONTEXT_TERMS = [
  'music','musical','dance','dancing','dj','night','nights','comedy','comedian','stand up','standup',
  'festival','fest','mela','classical','cultural','culture','film','films','movie','cinema','wedding','shaadi',
  'food','cuisine','concert','live','singer','party','celebration','bazaar','bazar','market','diwali','holi',
  'navratri','garba','raas','dandiya','independence','republic','heritage','association','fusion',
  'sitar','tabla','bharatanatyam','kathak','raga','ragas'
];

export const ROUTINE_RELIGIOUS_TITLES = [
  'regular sunday program','family youth kirtan darbar'
];

// Weekly and daily Gurdwara programs are not events people plan an evening around. Titles that
// mention a special occasion or a guest still pass.
const ROUTINE_RELIGIOUS_PATTERNS = [
  /\b(regular|weekly|daily|monthly|every)\b.*\b(diwan|divan|kirtan|program|programme|service|services|path|katha|darbar|sangat|class|classes|school|langar|seva|session|sessions)\b/,
  /\b(sunday|saturday|friday|morning|evening|weekend)\b.*\b(diwan|divan|kirtan|program|programme|service|services|path|katha|darbar|class|classes|school|langar|session|sessions)\b/,
  /\b(sukhmani sahib|asa di vaar|rehras|rehraas|sohila sahib|nitnem|japji sahib|jaap sahib|chaupai sahib|anand sahib|sangrand|puranmashi|masya)\b/,
  /\b(gurmat|kirtan|gurbani|punjabi|gurmukhi|sikhi) (class|classes|school|lessons?)\b/,
  /\blangar (seva|service)\b/
];
const SPECIAL_OCCASION_WORDS = [
  'gurpurab','gurpurb','purab','parkash','prakash','jayanti','vaisakhi','baisakhi','nagar kirtan','shaheedi',
  'shaheed','martyrdom','bandi chhor','diwali','hola mohalla','lohri','special','annual','celebration','guest',
  'visiting','jatha','samagam','mela','festival','camp','fundraiser','tour','anniversary','parade',
  'akhand path','sehaj path','bhai','bibi','giani','sant','baba'
];

export function isRoutineReligiousTitle(title) {
  const text = matchText(title);
  if (!text) return false;
  if (ROUTINE_RELIGIOUS_TITLES.some(item => text === matchText(item))) return true;
  if (relevant(text, SPECIAL_OCCASION_WORDS)) return false;
  return ROUTINE_RELIGIOUS_PATTERNS.some(pattern => pattern.test(text));
}

// Parking passes, VIP packages, platinum/club/suite products and similar add-ons that ticketing
// sites list as separate "events".
export function isTicketProduct(title) {
  const text = matchText(title);
  if (relevant(text, EVENT_PRODUCT_NOISE)) return true;
  return hasTerm(text, 'parking') && !hasTerm(text, 'parking lot');
}

export const MUSIC_TERMS = [
  'punjabi','panjabi','bhangra','diljit','aujla','sidhu','ap dhillon','shubh','jass',
  'gippy','ammy','nimrat','sunanda','jasmine sandlas','guru randhawa','babbu maan',
  'satinder sartaaj','jazzy b','sharry maan','punjabi music'
].map(x => x.toLowerCase());

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------
// `group` decides which scheduled run collects the source (see REFRESH_GROUPS).
// `trusted: true` means everything listed there is South Asian by nature (for example a
// Desi community listings site) so the title keyword check is skipped. Noise such as
// parking passes is still rejected.
//
// To add a source, add a line here and give it a group. Example:
//   { key:'my-desi-site', name:'My Desi Site', type:'community', trusted:true, region:'Seattle',
//     city:'Seattle', url:'https://example.com/events', group:'community' },

export const EVENT_SOURCES = [
  { key:'stg', name:'Seattle Theatre Group', type:'venue', region:'Seattle', city:'Seattle', url:'https://www.stgpresents.org/calendar/', group:'venues-seattle' },
  { key:'auburn-pac', name:'Auburn Performing Arts Center', type:'venue', region:'Seattle', city:'Auburn', url:'https://www.auburn.wednet.edu/district-departments/theatres/auburn-performing-arts-center-apac/auburn-performing-arts-center-calendar-of-events', group:'venues-seattle' },
  { key:'federal-way-paec', name:'Federal Way Performing Arts & Event Center', type:'venue', region:'Seattle', city:'Federal Way', url:'https://fwpaec.org/events/', group:'venues-seattle' },
  { key:'showare', name:'accesso ShoWare Center', type:'venue', region:'Seattle', city:'Kent', url:'https://www.accessoshowarecenter.com/p/events-and-tickets', group:'venues-seattle' },
  { key:'ticketleader', name:'TicketLeader Vancouver', type:'venue', region:'Vancouver', city:'Vancouver', url:'https://www.ticketleader.ca/events/', group:'venues-vancouver' },
  { key:'bell', name:'Bell Performing Arts Centre', type:'venue', region:'Vancouver', city:'Surrey', url:'https://tickets.bellperformingartscentre.com/TheatreManager/1/online', group:'venues-vancouver' },
  { key:'vct', name:'Vancouver Civic Theatres', type:'venue', region:'Vancouver', city:'Vancouver', url:'https://vancouvercivictheatres.com/events/', group:'venues-vancouver' },
  { key:'gsswa', name:'Gurdwara Singh Sabha of Washington', type:'religious', region:'Seattle', city:'Renton', url:'https://www.gsswa.org/', group:'religious' },
  { key:'gnsg', name:'Guru Nanak Sikh Gurdwara', type:'religious', region:'Vancouver', city:'Surrey', url:'https://gnsg.org/', group:'religious' },
  { key:'gnsg-calendar', name:'Guru Nanak Sikh Gurdwara Calendar', type:'religious', region:'Vancouver', city:'Surrey', url:'https://gnsg.org/calendar/', group:'religious' },
  { key:'surrey-vaisakhi', name:'Surrey Khalsa Day Vaisakhi Parade', type:'religious', region:'Vancouver', city:'Surrey', url:'https://www.surreyvaisakhiparade.com/', group:'religious' },
  { key:'meetup-bollywood-seattle', name:'Bollywood Seattle (Meetup)', type:'community', trusted:true, region:'Seattle', city:'Seattle', url:'https://meetup.com/seattlebollywood', group:'community' },
  { key:'sikh-heritage-bc', name:'Sikh Heritage BC', type:'religious', region:'Vancouver', city:'Surrey', url:'https://www.sikhheritagebc.ca/events', group:'religious' }
];

// News feeds. `trusted: true` means the whole feed is about Punjabi music, so every item is kept.
// Other feeds only keep items that mention a Punjabi music term or artist (NEWS_TERMS).
// To add a feed, add a line here; the "Event source health" panel shows how many items it returned.
export const NEWS_SOURCES = [
  { key:'ptc', name:'PTC Punjabi', url:'https://www.ptcpunjabi.co.in/rss', trusted:true },
  { key:'britasia', name:'BritAsia TV', url:'https://britasia.tv/feed/' },
  { key:'rollingstone-punjabi', name:'Rolling Stone India', url:'https://rollingstoneindia.com/tag/punjabi-music/feed/', trusted:true }
];

export const NEWS_TERMS = [...new Set([...MUSIC_TERMS, ...ARTIST_TERMS, 'bhangra','punjabi music','punjabi song','punjabi film'])];
export const NEWS_MAX_AGE_DAYS = 120;

// History reading links. Each listing page is scanned for article links whose PATH matches
// `pathPattern`; new articles are opened (a few per run) and read from their Open Graph tags.
// The public history archive is the chronological arrival series written as reviewed GitHub issues.
// External research sites belong in each article's Sources section, not as automatic story cards.
export const HISTORY_SOURCES = [];

export const SEATGEEK_SEARCHES = [
  { q:'Punjabi', country:'US', lat:47.6062, lon:-122.3321, meters:160934, region:'Seattle' },
  { q:'Bhangra', country:'US', lat:47.6062, lon:-122.3321, meters:160934, region:'Seattle' },
  { q:'Bollywood', country:'US', lat:47.6062, lon:-122.3321, meters:160934, region:'Seattle' },
  { q:'Punjabi', country:'CA', lat:49.2827, lon:-123.1207, meters:160934, region:'Vancouver' },
  { q:'Bhangra', country:'CA', lat:49.2827, lon:-123.1207, meters:160934, region:'Vancouver' },
  { q:'Bollywood', country:'CA', lat:49.2827, lon:-123.1207, meters:160934, region:'Vancouver' }
];

export const TICKETMASTER_AREAS = [
  { region:'Seattle',countryCode:'US',latlong:'47.6062,-122.3321' },
  { region:'Vancouver',countryCode:'CA',latlong:'49.2827,-123.1207' }
];

// Ticketmaster is searched by keyword (it used to read only the 200 soonest events of
// any kind). Each list is one scheduled run. Edit the artist lists freely.
export const TICKETMASTER_KEYWORDS = {
  core: ['punjabi','bhangra','bollywood','desi','sikh','hindi'],
  artistsA: ['diljit dosanjh','karan aujla','ap dhillon','arijit singh','shubh','honey singh'],
  artistsB: ['badshah','jasmine sandlas','amrinder gill','a r rahman','neha kakkar','babbu maan'],
  // Stand-up shows rarely have "Punjabi" or "desi" in the title, so search the comedians by name.
  comedyA: ['desi comedy','indian comedy','punjabi comedy', ...COMEDIAN_TERMS.slice(0,6)],
  comedyB: COMEDIAN_TERMS.slice(6)
};

const EVENTBRITE_QUERIES = ['punjabi','bollywood','desi','indian','punjabi-dj','bollywood-dj','desi-comedy','indian-comedy'];
export const EVENTBRITE_SEARCH_URLS = [
  ...EVENTBRITE_QUERIES.map(q => ({ region:'Seattle', url:`https://www.eventbrite.com/d/wa--seattle/${q}/` })),
  ...EVENTBRITE_QUERIES.map(q => ({ region:'Vancouver', url:`https://www.eventbrite.ca/d/canada--vancouver/${q}/` }))
];

// ---------------------------------------------------------------------------
// Refresh schedule
// ---------------------------------------------------------------------------
// The cron fires every 20 minutes and each run collects ONE group, which keeps every run well
// inside Cloudflare's per-run request limit. All groups are refreshed about every 3 hours 40 minutes.
export const REFRESH_GROUPS = [
  'tickets-core','tickets-artists-a','tickets-artists-b','tickets-comedy-a','tickets-comedy-b',
  'venues-seattle','venues-vancouver','religious','marketplaces','community','editorial'
];
export const REFRESH_SLOT_MS = 20 * 60 * 1000;

export function groupForTime(ms = Date.now()) {
  return REFRESH_GROUPS[Math.floor(ms / REFRESH_SLOT_MS) % REFRESH_GROUPS.length];
}

export const CONFIGURED_SOURCE_KEYS = new Set([
  ...EVENT_SOURCES.map(s => s.key),
  ...NEWS_SOURCES.map(s => s.key),
  ...HISTORY_SOURCES.map(s => s.key),
  'ticketmaster','ticketmaster-artists-a','ticketmaster-artists-b','ticketmaster-comedy-a','ticketmaster-comedy-b','eventbrite','seatgeek','github-events'
]);

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------
export function matchText(value='') {
  return String(value).toLowerCase().normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}

const compiledTerms = new WeakMap();
function compile(terms) {
  let compiled = compiledTerms.get(terms);
  if (!compiled) {
    compiled = terms.map(t => matchText(t)).filter(Boolean).map(t => ` ${t} `);
    compiledTerms.set(terms, compiled);
  }
  return compiled;
}

export function hasTerm(text, term) {
  const needle = matchText(term);
  return Boolean(needle) && (` ${matchText(text)} `).includes(` ${needle} `);
}

export function relevant(text, terms = EVENT_TERMS) {
  const haystack = ` ${matchText(text)} `;
  return compile(terms).some(term => haystack.includes(term));
}

export function screenEventIdentity(raw, source={}) {
  const title=String(raw?.title||'');
  if (!title.trim()) return {keep:false,reason:'missing_title'};
  const product=isTicketProduct(title);
  // A person already approved this event, so keyword screening does not apply. Obvious ticket
  // add-ons are still refused in case an issue was approved by mistake.
  if (source.type==='manual') return product?{keep:false,reason:'ticket_add_on_or_known_noise'}:{keep:true,reason:'manually_approved'};
  if (source.type==='religious' && isRoutineReligiousTitle(title)) return {keep:false,reason:'routine_gurdwara_program'};
  if (product||relevant(title,KNOWN_EVENT_FALSE_POSITIVES)) return {keep:false,reason:'ticket_add_on_or_known_noise'};
  if (relevant(title,AMBIGUOUS_INDIAN_PHRASES)) return {keep:false,reason:'ambiguous_non_south_asian_match'};
  if (source.trusted) return {keep:true,reason:'trusted_source'};
  const performers=[].concat(raw?.performers||[]).filter(Boolean).join(' ');
  const named=`${title} ${performers}`;
  if (relevant(named,EVENT_TERMS)) return {keep:true,reason:'accepted'};
  // "Indian" on its own is too broad; it counts only next to a cultural word (music, night, comedy ...).
  if (hasTerm(named,'indian') && relevant(named,INDIAN_CONTEXT_TERMS)) return {keep:true,reason:'accepted'};
  const description=String(raw?.description||'');
  // Religious sources may use any keyword in the description because recurring program titles
  // can be generic. Other sources only count the stronger cultural words, so page boilerplate
  // or unrelated marketing copy does not let events in.
  if (source.type==='religious' && relevant(description,EVENT_TERMS)) return {keep:true,reason:'accepted_description'};
  if (relevant(description,DESCRIPTION_TERMS)) return {keep:true,reason:'accepted_description'};
  return {keep:false,reason:'no_south_asian_identity_signal'};
}

export function categoryFor(text, sourceType = '') {
  const s = String(text || '').toLowerCase();
  if (sourceType === 'religious' || /sikh|gurdwara|gurudwara|kirtan|gurbani|gurpurab|vaisakhi|baisakhi|nagar/.test(s)) return 'religious';
  if (/stand[ -]?up|comedy|comedian/.test(s) || relevant(s, COMEDIAN_TERMS)) return 'comedy';
  if (/theatre|theater|\bplay\b|stage|performing arts/.test(s)) return 'theatre';
  if (/bhangra|\bdjs?\b|night|party|club|dance/.test(s)) return 'nightlife';
  if (/mela|festival|parade|vaisakhi|baisakhi|garba|dandiya|lohri/.test(s)) return 'festival';
  if (/concert|tour|live|singer|music/.test(s)) return 'concert';
  if (sourceType === 'venue') return 'theatre';
  return 'community';
}
