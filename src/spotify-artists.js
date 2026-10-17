// Spotify playlist snapshot, 2026-10-16; https://open.spotify.com/playlist/37i9dQZF1DX5baCFRgbF3x
// Includes credited collaborators; not an automatic Spotify sync. Refresh by hand from the playlist.
// Names in genericSpotifyArtists below are ordinary words, surnames or common phrases. They never match
// from an event title and are never searched; they only count as a credited performer on a Music event.
export const spotifyArtists = [
  "Aastha Gill",
  "Aman Hothi",
  "Aman Sumal",
  "Amrinder Gill",
  "Amrit Maan",
  "Aniket",
  "Aparshakti Khurana",
  "Arjan Dhillon",
  "Arjan virk",
  "Armaan Gill",
  "Arnaaz Gill",
  "Arshaan",
  "Arvin Beatz",
  "Ary B",
  "Aryan Saini",
  "Asees Kaur",
  "Atix Chawla",
  "Avkash Mann",
  "Avvy Sra",
  "Avy",
  "Baaghi",
  "Babbal Rai",
  "Bannet Dosanjh",
  "Bilal Wajid",
  "Boby Alam",
  "Byg Byrd",
  "CHAHAL",
  "Chandra Brar",
  "Chani Nattan",
  "Chinna",
  "Daaku",
  "Danny",
  "Dark Soul Studioz",
  "Deep Gherra",
  "Deep Jandu",
  "Deep Sohi",
  "Deepa Kaler",
  "Desi Crew",
  "Devilo",
  "Diljan",
  "Diljit Chitti",
  "Dilmaan",
  "DILRAJ BHEORA",
  "Dishant",
  "Divrose",
  "dox",
  "Dr Zeus",
  "Dropped Out",
  "DRUFF",
  "EAGLE BEATZ",
  "Erikk",
  "EXCISE DEPT",
  "Frankie",
  "Fuego",
  "Gabru",
  "Gagan Kooner",
  "Gaiphy",
  "Gill Machhrai",
  "GKhan",
  "Goldboy",
  "Gravity",
  "Gulab Sidhu",
  "Gur Malhi",
  "Guri Lahoria",
  "Gurjit Gill",
  "Gurlez Akhtar",
  "Gurmanter",
  "Gurmeet Singh",
  "Gurnam Bhullar",
  "Gurpreet Saini",
  "Gursewak Likhari",
  "Gurshabad",
  "Guru Randhawa",
  "Hairat Aulakh",
  "Happy Raikoti",
  "Harkaran Ghotra",
  "Harmanjeet Singh",
  "Harry Sharan",
  "Himmat Sandhu",
  "Hiten",
  "Honey Ramana",
  "icyNav",
  "Inder Chahal",
  "Inderpal Moga",
  "IRIS Music",
  "JAI DHIR",
  "JASKARAN",
  "Jasmeen Akhtar",
  "Jass Sandhu",
  "Jassa Dhaliwal",
  "Jassi Lohka",
  "Jay K",
  "JayB Singh",
  "Jaymeet",
  "Jazleen Kaur",
  "Jind",
  "Jind Dhillon",
  "Jodha Dhillon",
  "Jot Virk",
  "Jyotica Tangri",
  "Kabir",
  "Kahlon",
  "Kanji Porh",
  "Karan Aujla",
  "Karan Thabal",
  "Karman Boha",
  "Kaur Prabh",
  "Khan Mallan Wala",
  "Kidjaywest",
  "Korala Maan",
  "Kulshan Sandhu",
  "Kulwinder Billa",
  "Kunwarr",
  "Lakhi Ghuman",
  "Lavish Dhiman",
  "Love Aujla",
  "Lucky Lohka",
  "MAAHIIR",
  "Malkeet Live",
  "Manak-E",
  "Manavgeet Gill",
  "Maninder Buttar",
  "Mann Deep",
  "Master Mind",
  "Meet Singh Music",
  "Miss Pooja",
  "Mitansh",
  "MixSingh",
  "Mxrci",
  "Nav Dolorain",
  "Navvi",
  "NDS",
  "Nirvair Pannu",
  "Nishawn Bhullar",
  "Noor Chahal",
  "NOXI",
  "Nyc Beat",
  "Prabh Bajwa",
  "Preet Hundal",
  "Prince Dandiwal",
  "Prince Narula",
  "Prodgk",
  "Qarn Mallhi",
  "Ragini Tandan",
  "Raizada .",
  "Raj Fatehpur",
  "Raj Ranjodh",
  "Raja Kumari",
  "Rashid Khan",
  "Ravinder Grewal",
  "Ravneet Singh",
  "RCKLSS",
  "Real Boss",
  "Ridham Kalyan",
  "Rish",
  "Rochak Kohli",
  "Rony Ajnali",
  "RUMANE",
  "Saanjh Kaur",
  "Sachin Ahuja",
  "Saggi Nexuss",
  "Sam Malhi",
  "Sam Malik",
  "Sandy Sandhu",
  "SARRB",
  "Savi Kahlon",
  "Shah Rehan",
  "Sharan Rawat",
  "Sharry Mann",
  "Shehnaz Akhtar",
  "Shevv",
  "Shipra Goyal",
  "Showkidd",
  "Sidhu Moose Wala",
  "Siippyy Gill",
  "Starboy X",
  "Sukh Sanghera",
  "Suyash",
  "Talwiinder",
  "Tarna",
  "Tesher",
  "The Turbo",
  "thiarajxtt",
  "THOUGHT",
  "Tippu Sultan",
  "Veer Sandhu",
  "Vicky Saini",
  "Vishav Dhaliwal",
  "Watan Sahi",
  "Yeah Proof",
  "Yoki",
  "ZAYL"
];

// Ambiguous names: common words, surnames, film titles or phrases that also appear in unrelated events
// (\"Master Mind Trivia\", \"Gravity\", \"Kabir Bedi Talk\"). Everything else in spotifyArtists is distinctive.
export const genericSpotifyArtists = [
  "Aniket","Arshaan","Ary B","Avy","Baaghi","CHAHAL","Chinna","Daaku","Danny","Desi Crew","Devilo","Diljan",
  "Dilmaan","Dishant","Divrose","dox","Dropped Out","DRUFF","Erikk","EXCISE DEPT","Frankie","Fuego","Gaiphy",
  "Goldboy","Gravity","Hiten","Jay K","Jaymeet","Jind","Kabir","Kahlon","Mann Deep","Master Mind","Mitansh",
  "Navvi","NDS","Raizada .","Rashid Khan","Real Boss","Rish","Sam Malhi","Sam Malik","Shevv","Showkidd",
  "Starboy X","Suyash","Tarna","The Turbo","THOUGHT","Tippu Sultan","Yeah Proof","Yoki","ZAYL"
];

const normalize = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const genericSet = new Set(genericSpotifyArtists.map(normalize));
const distinctNames = [...new Set(spotifyArtists.map(normalize))].filter(name => name && !genericSet.has(name));
const genericNames = [...genericSet];
const isMusic = raw => /^music$/i.test(String(raw?.genre || ""));

// Distinctive names match a credited performer or the title (single-word names such as Talwiinder included).
// Generic names match only a credited performer on a Music event, which ticket sites supply as structured data.
export function matchesSpotifyArtist(raw) {
  const credits = [].concat(raw?.performers || []).map(normalize);
  const title = " " + normalize(raw?.title) + " ";
  if (distinctNames.some(name => credits.includes(name) || title.includes(" " + name + " "))) return true;
  return isMusic(raw) && genericNames.some(name => credits.includes(name));
}

// Names worth searching on Ticketmaster: distinctive ones not already in the fixed keyword lists.
export function spotifySearchNames(skip = []) {
  const skipped = new Set(skip.map(normalize));
  return spotifyArtists.filter(name => { const n = normalize(name); return n && !genericSet.has(n) && !skipped.has(n); });
}

// Each of the two Spotify groups searches `size` names per cycle, advancing through the list
// every time all refresh groups have run once, and wrapping around at the end.
export function spotifyBatch(names, part, cycle, size = 16) {
  if (!names.length) return [];
  const start = ((cycle * 2 + part) * size) % names.length;
  return Array.from({ length: Math.min(size, names.length) }, (_, i) => names[(start + i) % names.length]);
}

// Distinctive playlist names that appear in an event title, in the playlist's own spelling.
const distinctByNormalized = new Map(spotifyArtists.map(name => [normalize(name), name]).filter(([n]) => n && !genericSet.has(n)));
export function knownArtistsInTitle(title) {
  const text = " " + normalize(title) + " ";
  return [...distinctByNormalized].filter(([n]) => text.includes(" " + n + " ")).map(([, name]) => name);
}
export function isSpotifyArtist(name) {
  return spotifyArtists.some(item => normalize(item) === normalize(name));
}
