// Deliberately has no cloud credentials or upstream access.
import http from 'node:http';
import fs from 'node:fs/promises';
import {avatarCloud} from '../../lib/avatar/cloud.mjs';
const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1:5291');
  if (/^\/api\/avatar\/(chat|image|status)$/.test(u.pathname)){
    const parts=[];for await(const c of req)parts.push(c);
    const request=new Request(u,{method:req.method,headers:{origin:'https://apps-demo.muyang23333.top','content-type':'application/json'},body:req.method==='POST'?Buffer.concat(parts):undefined});
    const r=await avatarCloud({request,clientIp:null,env:{}},u.pathname.split('/').pop(),()=>{throw Error('Offline preview');});
    res.writeHead(r.status,{'Content-Type':'application/json'});return res.end(await r.text());
  }
  if(!/^\/avatar\/(?:[\w.-]+)?$/.test(u.pathname))throw Error();
  const file=u.pathname.split('/').pop()||'index.html';
  if(!/^[\w-]+\.(html|css|js)$/.test(file))throw Error();
  const body=await fs.readFile(new URL('./dist/'+file,import.meta.url));
  res.writeHead(200,{'Content-Type':({'html':'text/html','css':'text/css','js':'text/javascript'})[file.split('.').pop()]+'; charset=utf-8'});res.end(body);
}catch{res.writeHead(404);res.end();}});
server.listen(5291,'127.0.0.1');
