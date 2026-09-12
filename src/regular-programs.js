// Match routine program titles, not all religious events or descriptions.
export const REGULAR_PROGRAM_TERMS = [
  'regular sunday program', 'family youth kirtan darbar',
  'weekly sunday divan', 'weekly divan', 'daily divan',
  'weekly kirtan', 'daily kirtan', 'sunday divan',
  'regular weekly program', 'weekly gurdwara program',
  'daily gurdwara program', 'sunday service',
  'weekly gurudwara program', 'daily gurudwara program'
];
export function isRegularProgram(title) {
  const text=String(title||'').toLowerCase();
  return REGULAR_PROGRAM_TERMS.some(term=>text.includes(term));
}
