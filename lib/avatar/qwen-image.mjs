import {PNG} from 'pngjs';
import jpeg from 'jpeg-js';
const endpoint='https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
export async function qwenImage(key,model,prompt,lang,transport){
  const err=(zh,en)=>Object.assign(new Error(lang==='en'?en:zh),{code:'QWEN_IMAGE_ERROR',status:502});
  const signal=AbortSignal.timeout(93000);
  try{
    const r=await transport(endpoint,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},redirect:'error',signal,
      body:JSON.stringify({model,input:{messages:[{role:'user',content:[{text:prompt}]}]},parameters:{n:1,size:'1024*1024',prompt_extend:false}})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||data.code){
      if(r.status===401||r.status===403)throw err('千问拒绝了调用，请检查百炼密钥及模型权限。','Qwen rejected the credentials or model permissions.');
      if(r.status===429)throw err('千问目前限流或额度不足，没有重试。','Qwen is rate or quota limited.');
      if(/datainspection|content|safety/i.test(data.code||''))throw err('千问未通过本次图片的内容检查。','The image did not pass Qwen content checks.');
      throw err('千问未完成生成（HTTP '+r.status+'）。','Qwen generation failed (HTTP '+r.status+').');
    }
    const src=data.output?.choices?.[0]?.message?.content?.find(c=>typeof c?.image==='string')?.image;
    const u=new URL(src);
    if(u.protocol!=='https:'||u.username||u.password||u.port||!/^dashscope-result[-a-z0-9]*\.oss[-a-z0-9]+\.aliyuncs\.com$/.test(u.hostname))throw Error();
    const out=await transport(u.href,{redirect:'error',signal});if(!out.ok||!out.body)throw Error();
    const chunks=[];let length=0;
    for await(const chunk of out.body){length+=chunk.length;if(length>6*1024*1024)throw Error();chunks.push(chunk);}
    let buf=Buffer.concat(chunks);
    if(buf.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&buf.length>=24&&buf.readUInt32BE(16)===1024&&buf.readUInt32BE(20)===1024){
      buf=jpeg.encode(PNG.sync.read(buf),88).data;
    }
    if(buf[0]!==255||buf[1]!==216||buf[2]!==255||buf.length>4*1024*1024)throw Error();
    return {image:'data:image/jpeg;base64,'+buf.toString('base64'),provider:'Qwen',model,mode:'live'};
  }catch(e){
    if(e?.code==='QWEN_IMAGE_ERROR')throw e;
    throw err('未收到可用的千问图片，没有重复提交生成。','No usable Qwen image was received. Generation was not repeated.');
  }
}
