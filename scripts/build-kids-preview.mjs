import {cp,mkdir,rm} from 'node:fs/promises';
const dest=new URL('../.kids-preview/',import.meta.url);
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
await cp(new URL('../prototypes/panjabi-kids-pnw-pilot.html',import.meta.url),new URL('index.html',dest));
await mkdir(new URL('art/',dest));
for(const region of ['pnw','england','east-africa','asia'])for(let chapter=1;chapter<=5;chapter++)await cp(new URL(`../prototypes/art/${region}-chapter-${chapter}.webp`,import.meta.url),new URL(`art/${region}-chapter-${chapter}.webp`,dest));
console.log('Built isolated static storybook: four regions, twenty chapters.');
