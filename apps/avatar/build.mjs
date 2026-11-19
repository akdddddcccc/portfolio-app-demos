import {cpSync} from 'node:fs';
cpSync(new URL('./site/',import.meta.url),new URL('./dist/',import.meta.url),{recursive:true});
