import {PNG} from 'pngjs';
import jpeg from 'jpeg-js';
import {networkCause} from './image-error.mjs';
const endpoint='https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
export async function qwenImage(key,model,prompt,lang,transport,ipv4){
  const err=(zh,en)=>Object.assign(new Error(lang==='en'?en:zh),{code:'QWEN_IMAGE_ERROR',status:502});
  const signal=AbortSignal.timeout(93000);
  let step='提交',source;
  try{
    if(!/^[!-~]+$/.test(key))throw err('百炼密钥里含有无效字符，请检查腾讯云的变量值。','Invalid characters in configured Qwen key.');
    let submit=transport;
    if(ipv4){
      step='连接百炼';let connected=false;
      for(const tryRoute of [transport,ipv4]){
        try{const probe=await tryRoute('https://dashscope.aliyuncs.com/compatible-mode/v1/models',{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(3000)});
          await probe.body?.cancel();submit=tryRoute;connected=true;break;
        }catch{}
      }
      if(!connected)throw err('生图服务器无法连接百炼，两条直连检查都失败；尚未提交生图。','Cannot reach Qwen. No generation submitted.');
    }
    step='提交';
    const r=await submit(endpoint,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},redirect:'error',signal,
      body:JSON.stringify({model,input:{messages:[{role:'user',content:[{text:prompt}]}]},parameters:{n:1,size:'1024*1024',prompt_extend:false}})});
    step='解析生成响应';
    const data=await r.json();
    if(!r.ok||data.code){
      if(r.status===401||r.status===403)throw err('千问拒绝了调用，请检查百炼密钥及模型权限。','Qwen rejected the credentials or model permissions.');
      if(r.status===429)throw err('千问目前限流或额度不足，没有重试。','Qwen is rate or quota limited.');
      if(/datainspection|content|safety/i.test(data.code||''))throw err('千问未通过本次图片的内容检查。','The image did not pass Qwen content checks.');
      throw err('千问未完成生成（HTTP '+r.status+'）。','Qwen generation failed (HTTP '+r.status+').');
    }
    const src=data.output?.choices?.[0]?.message?.content?.find(c=>typeof c?.image==='string')?.image;
    step='读取原图地址';
    const u=new URL(src);
    if(u.protocol!=='https:'||u.username||u.password||u.port||!/^(?:dashscope-result[-a-z0-9]*\.oss[-a-z0-9]+|dashscope-[0-9]{4}\.oss-accelerate)\.aliyuncs\.com$/.test(u.hostname)){
      const host=u.hostname.endsWith('.aliyuncs.com')?u.hostname:'unrecognized host';
      throw err('千问已返回结果，但原图域名未获准读取：'+host,'Unexpected image host: '+host);
    }
    source=u.href;step='下载原图';
    const out=await transport(u.href,{redirect:'error',signal});if(!out.ok||!out.body)throw Error();
    const chunks=[];let length=0;
    for await(const chunk of out.body){length+=chunk.length;if(length>6*1024*1024)throw Error();chunks.push(chunk);}
    let buf=Buffer.concat(chunks);
    step='转换 JPG';
    if(buf.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&buf.length>=24&&buf.readUInt32BE(16)*buf.readUInt32BE(20)<=4194304){
      buf=jpeg.encode(PNG.sync.read(buf),88).data;
    }
    if(buf[0]!==255||buf[1]!==216||buf[2]!==255||buf.length>4*1024*1024)throw Error();
    return {image:'data:image/jpeg;base64,'+buf.toString('base64'),provider:'Qwen',model,mode:'live'};
  }catch(e){
    if(e?.code==='QWEN_IMAGE_ERROR')throw e;
    if(source)return {source,provider:'Qwen',model,mode:'live'};
    const cause=signal.aborted?'TIMEOUT':networkCause(e);
    throw err('千问在「'+step+'」阶段失败（'+cause+'），没有重复生图。','Qwen image request failed ('+cause+'). No duplicate generation.');
  }
}
