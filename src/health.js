// Turns a source_status row into something a person can act on.

const REASON_TEXT = {
  no_south_asian_identity_signal: 'no Punjabi/South Asian keyword',
  ticket_add_on_or_known_noise: 'ticket add-on or known noise',
  ambiguous_non_south_asian_match: 'not a South Asian event',
  routine_gurdwara_program: 'routine weekly program',
  missing_title: 'no title',
  invalid_or_missing_date: 'no usable date',
  no_music_keyword: 'no Punjabi music keyword'
};

const PAGE_TYPES = new Set(['venue','religious','community']);

export function parseSamples(value) {
  try { const rows = JSON.parse(value || '[]'); return Array.isArray(rows) ? rows : []; } catch { return []; }
}

function errorHint(error) {
  if (/HTTP 403/.test(error)) return 'The site blocks automated requests (HTTP 403).';
  if (/HTTP 429/.test(error)) return 'The site is rate limiting requests (HTTP 429).';
  if (/HTTP 404/.test(error)) return 'Page not found (HTTP 404). Check the address.';
  if (/HTTP 5\d\d/.test(error)) return `The site could not be reached (${error.match(/HTTP 5\d\d/)[0]}). Check the address.`;
  if (/budget/i.test(error)) return 'Skipped this cycle to stay within the request limit. It will run again.';
  return error;
}

export function describeSource(row) {
  const error = String(row.last_error || '');
  const kept = Number(row.last_count || 0);
  const raw = row.raw_count === null || row.raw_count === undefined ? null : Number(row.raw_count);
  const rejected = Number(row.rejected_count || 0);
  const samples = parseSamples(row.sample_rejected);

  if (/^Waiting for /i.test(error)) {
    return { state:'setup', label:'Setup needed', detail:`${error.replace(/^Waiting for /i,'')} has not been added yet.` };
  }
  if (error) return { state:'error', label:'Needs attention', detail:errorHint(error) };

  const [one, many] = ['news','history'].includes(row.source_type) ? ['story','stories'] : ['event','events'];
  if (kept > 0) {
    return { state:'ok', label:`${kept} ${kept === 1 ? one : many}`, detail: rejected > 0 ? `${rejected} other listing${rejected === 1 ? '' : 's'} screened out.` : '' };
  }
  if (raw === null) return { state:'ok', label:`${kept} found`, detail:'' };
  if (raw === 0 && row.source_type === 'news') {
    return { state:'empty', label:'Feed has no items', detail:'The address loaded, but no stories were found in it. Check that it is an RSS or Atom feed address.' };
  }
  if (raw === 0 && row.source_type === 'history') {
    return { state:'empty', label:'No article links found', detail:'The page loaded, but none of its links looked like articles. The link pattern for this source may need adjusting.' };
  }
  if (raw === 0) {
    return PAGE_TYPES.has(row.source_type)
      ? { state:'empty', label:'No event data found', detail:'The page loaded, but no readable event listings were on it. This source may need a different collection method.' }
      : { state:'empty', label:'No matching listings', detail:'The search returned nothing for these keywords.' };
  }
  const shown = samples.slice(0, 3).map(x => `“${x.title}” (${REASON_TEXT[x.reason] || x.reason})`).join('; ');
  return { state:'filtered', label:`${raw} found, none kept`, detail: shown ? `Screened out, for example: ${shown}` : 'Every listing was screened out.' };
}
