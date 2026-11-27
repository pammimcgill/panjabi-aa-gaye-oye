import { mkdir, readFile, writeFile } from 'node:fs/promises';

const origin = 'https://generativelanguage.googleapis.com/v1beta';
const model = 'gemini-3.1-flash-image';
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is missing.');
const headers = { 'x-goog-api-key': key, 'content-type': 'application/json' };
async function request(path, body) {
  let response;
  try {
    response = await fetch(origin + path, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body && JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(90000),
    });
  } catch {
    throw new Error('Gemini request failed before a response was received.');
  }
  if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}.`);
  return response.json();
}
const supported = [];
for (let token = ''; token !== null;) {
  const query = new URLSearchParams({ pageSize: '100' });
  if (token) query.set('pageToken', token);
  const page = await request('/models?' + query);
  for (const entry of page.models ?? []) {
    if (/^models\/(gemini-[\w.\-]*(image|banana)[\w.\-]*|imagen-[\w.\-]+)$/.test(entry.name)) {
      supported.push(entry.name);
    }
  }
  token = page.nextPageToken || null;
}
console.log('Image candidates listed by Gemini:', supported.join(', '));
if (!supported.includes('models/' + model)) throw new Error('Selected image model is unavailable.');
const reference = await readFile('public/history-comics/why-they-left/page-1.webp');
const result = await request('/models/' + model + ':generateContent', {
  contents: [{ parts: [
    { text: 'Create one photorealistic historical reconstruction of late-1890s rural Punjab. An adult Punjabi Sikh tenant farmer in a plain tied turban and cotton kurta listens to a local lender over a paper ledger in a modest shaded courtyard. Preserve the restrained posture and rural setting in the provided illustration. Warm sepia monochrome, subtle film grain, soft side light, authentic period fabrics and earthen architecture. Fictional people and scene with no legible text, captions, frames, branding, modern items or signatures.' },
    { inlineData: { mimeType: 'image/webp', data: reference.toString('base64') } },
  ] }],
  generationConfig: { candidateCount: 1, responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5', imageSize: '1K' } },
});
const image = result.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
if (!image || !Object.hasOwn(extensions, image.mimeType)) throw new Error('Gemini returned no supported image.');
await mkdir('instagram-gemini-pilot', { recursive: true });
await writeFile('instagram-gemini-pilot/raw.' + extensions[image.mimeType], Buffer.from(image.data, 'base64'));
await writeFile('instagram-gemini-pilot/review.json', JSON.stringify({
  account: '@5abiaagayeoye', model, supported, status: 'test-only',
  disclosure: 'AI-generated historical reconstruction', usage: result.usageMetadata,
}, null, 2));
console.log('Generated one test image.');
