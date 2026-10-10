import {cp,mkdir,rm} from 'node:fs/promises';
const dest=new URL('../.kids-preview/',import.meta.url);
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
await cp(new URL('../prototypes/panjabi-kids-pnw-pilot.html',import.meta.url),new URL('index.html',dest));
await cp(new URL('../prototypes/art/',import.meta.url),new URL('art/',dest),{recursive:true});
console.log('Built isolated static storybook in .kids-preview/');
