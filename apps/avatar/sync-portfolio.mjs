// Run manually against a reviewed portfolio checkout. No .env or private files are copied.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
if(!process.argv[2])throw Error('Pass a portfolio checkout');
const root=path.resolve(process.argv[2]),out=fileURLToPath(new URL('./site/',import.meta.url)),back=path.resolve(out,'../../../lib/avatar');
fs.mkdirSync(back,{recursive:true});const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {projects}=await import(pathToFileURL(path.join(root,'src/data/projects.js')));
const {posters}=await import(pathToFileURL(path.join(root,'src/data/posters.js')));
const {content}=await import(pathToFileURL(path.join(root,'src/data/content.js')));
const pub=projects.filter(p=>!p.closed&&p.discipline!=='unpublished'&&/^[a-z0-9-]+$/.test(p.slug)).map(({slug,title,discipline,tags,details})=>({slug,title,discipline,tags,details:Object.fromEntries(['zh','en'].map(l=>[l,{description:details?.[l]?.description||''}]))}));
const art=posters.map(({id,title,setting,description})=>({id,title,setting,description}));
const put=(dir,name,data)=>fs.writeFileSync(path.join(dir,name),data);
put(back,'profile.mjs','export const content='+JSON.stringify({about:Object.fromEntries(['zh','en'].map(l=>[l,{sections:content.about[l].sections.map(({body})=>({body}))}])),contact:{items:content.contact.items}})+';\n');
const navdata="export const projects="+JSON.stringify(pub.map(({slug,title,discipline})=>({slug,title,discipline})))+";\nexport const posters="+JSON.stringify(art.map(({id,title})=>({id,title})))+";\n";
put(out,'catalog.js',navdata);put(out,'profile.js','export const content='+JSON.stringify({contact:{items:content.contact.items}})+';\n');
put(back,'catalog.mjs','export const projects='+JSON.stringify(pub)+';\nexport const posters='+JSON.stringify(art)+';\n');
put(out,'target.js',read('src/utils/chatWorkTarget.js').replace(/^import .*?;\r?\nimport .*?;/,'import {projects,posters} from "./catalog.js";').replace("const root='#/'","const root='https://muyang23333.top/#/'"));
// Only refresh public catalogues and work destinations. The app owns its UI and cloud runtime.
