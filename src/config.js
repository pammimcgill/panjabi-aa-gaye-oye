export const EVENT_TERMS = [
  'diwali','deepavali','holi','navratri','navaratri','karwa','karva','raksha bandhan','onam','pongal','ugadi','ganesh','eid','qawwali','sufi','hindustani','carnatic','bharatanatyam','kathak','indian','pakistani','bangladeshi','sri lankan','nepali','tamil','telugu','malayalam','gujarati','bengali','marathi','hindi','urdu','falguni','punjabi','panjabi','bhangra','sikh','gurdwara','gurudwara','kirtan','gurbani',
  'vaisakhi','baisakhi','nagar kirtan','desi','bollywood','south asian','dhol',
  'mehfil','mela','garba','dandiya','diljit','karan aujla','gurdas maan','satinder sartaaj',
  'babbu maan','ammy virk','sidhu','jass','guru randhawa','shreya ghoshal','sonu nigam'
];

export const MUSIC_TERMS = [
  'punjabi','panjabi','bhangra','diljit','auJla','sidhu','ap dhillon','shubh','jass',
  'gippy','ammy','nimrat','sunanda','jasmine sandlas','guru randhawa','babbu maan',
  'satinder sartaaj','jazzy b','sharry maan','punjabi music'
].map(x => x.toLowerCase());

export const EVENT_SOURCES = [
  {key:'seattle-indian',name:'Seattle Indian',type:'community',dedicated:true,region:'Seattle',url:'https://www.seattleindian.com/seattle/eventcalendar.asp'},
  {key:'simply-desi',name:'Simply Desi',type:'community',dedicated:true,region:'Seattle',url:'https://simplydesi.us/seattle/events'},
  {key:'eventbrite-indian',name:'Eventbrite Indian Events',type:'community',dedicated:true,region:'Seattle',url:'https://www.eventbrite.com/d/wa--seattle/indian/'},
  {key:'seattle-center',name:'Seattle Center Festal',type:'community',region:'Seattle',city:'Seattle',url:'https://seattlecenter.com/events/featured-events/festal'},

  { key:'stg', name:'Seattle Theatre Group', type:'venue', region:'Seattle', city:'Seattle', url:'https://www.stgpresents.org/calendar/' },
  { key:'ticketleader', name:'TicketLeader Vancouver', type:'venue', region:'Vancouver', city:'Vancouver', url:'https://www.ticketleader.ca/events/' },
  { key:'bell', name:'Bell Performing Arts Centre', type:'venue', region:'Vancouver', city:'Surrey', url:'https://tickets.bellperformingartscentre.com/TheatreManager/1/online' },
  { key:'vct', name:'Vancouver Civic Theatres', type:'venue', region:'Vancouver', city:'Vancouver', url:'https://vancouvercivictheatres.com/events/' },
  { key:'gsswa', name:'Gurdwara Singh Sabha of Washington', type:'religious', region:'Seattle', city:'Renton', url:'https://www.gsswa.org/' },
  { key:'gnsg', name:'Guru Nanak Sikh Gurdwara', type:'religious', region:'Vancouver', city:'Surrey', url:'https://gnsg.org/' },
  { key:'gnsg-calendar', name:'Guru Nanak Sikh Gurdwara Calendar', type:'religious', region:'Vancouver', city:'Surrey', url:'https://gnsg.org/calendar/' },
  { key:'surrey-vaisakhi', name:'Surrey Khalsa Day Vaisakhi Parade', type:'religious', region:'Vancouver', city:'Surrey', url:'https://www.surreyvaisakhiparade.com/' },
  { key:'sikh-heritage-bc', name:'Sikh Heritage BC', type:'religious', region:'Vancouver', city:'Surrey', url:'https://www.sikhheritagebc.ca/events' }
];

export const NEWS_SOURCES = [
  { key:'ptc', name:'PTC Punjabi', url:'https://www.ptcpunjabi.co.in/rss' },
  { key:'britasia', name:'BritAsia TV', url:'https://britasia.tv/feed/' },
  { key:'rollingstone-punjabi', name:'Rolling Stone India', url:'https://rollingstoneindia.com/tag/punjabi-music/feed/' }
];

export const HISTORY_SOURCES = [
  { key:'sikhri-history', name:'Sikh Research Institute', url:'https://sikhri.org/articles', type:'history' },
  { key:'sikhri-panjab', name:'Sikh Research Institute', url:'https://sikhri.org/tags/punjab', type:'history' }
];

export const SEATGEEK_SEARCHES = [
  { q:'Punjabi', country:'US', lat:47.6062, lon:-122.3321, meters:160934, region:'Seattle' },
  { q:'Bhangra', country:'US', lat:47.6062, lon:-122.3321, meters:160934, region:'Seattle' },
  { q:'Punjabi', country:'CA', lat:49.2827, lon:-123.1207, meters:160934, region:'Vancouver' },
  { q:'Bhangra', country:'CA', lat:49.2827, lon:-123.1207, meters:160934, region:'Vancouver' }
];

export function relevant(text, terms = EVENT_TERMS) {
  const haystack = String(text || '').toLowerCase();
  return terms.some(term => haystack.includes(term));
}

export function categoryFor(text, sourceType = '') {
  const s = String(text || '').toLowerCase();
  if (/bazaar|bazar|market|shopping|vendor|karwa|karva/.test(s)) return 'market';
  if (/festival|diwali|deepavali|holi|navratri|navaratri|mela|parade|vaisakhi|baisakhi|garba|dandiya|onam|pongal/.test(s)) return 'festival';
  if (sourceType === 'religious' || /sikh|gurdwara|gurudwara|kirtan|gurbani|vaisakhi|baisakhi|nagar/.test(s)) return 'religious';
  if (/theatre|theater|play|comedy|stage|performing arts/.test(s)) return 'theatre';
  if (/bhangra|dj|night|party|club|dance/.test(s)) return 'nightlife';
  if (/mela|festival|parade|vaisakhi|baisakhi|garba|dandiya/.test(s)) return 'festival';
  if (/concert|tour|live|singer|music/.test(s)) return 'concert';
  if (sourceType === 'venue') return 'theatre';
  return 'community';
}

export function inRegion(raw, source) {
  const text=[raw.city,raw.venue].filter(Boolean).join(' ').toLowerCase();
  const terms=source.region==='Vancouver'
    ? ['vancouver','surrey','burnaby','richmond','coquitlam','langley','delta','abbotsford','new westminster']
    : ['seattle','bellevue','redmond','renton','kent','everett','bothell','kirkland','tacoma','lynnwood','sammamish','issaquah','auburn','federal way','woodinville','puyallup','olympia'];
  return terms.some(term=>text.includes(term)) || (!raw.city && Boolean(source.city));
}
