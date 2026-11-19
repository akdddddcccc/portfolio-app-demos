import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {createProviders} from './providers.mjs';
import {demoReply} from './knowledge.mjs';
import {lightLimit} from './light-limit.mjs';
import {knownImageFailure} from './image-error.mjs';

// One Lua transaction per reservation across all function instances. No raw
// IP, conversation text, or pictures are stored. Failure never permits spend.
const lua=`
local c={}
for i=1,4 do c[i]=tonumber(redis.call('GET',KEYS[i]) or '0') end
local i=tonumber(ARGV[1]); local result=0
if i>0 then
 if redis.call('EXISTS',KEYS[5])==1 then result=2
 elseif c[i]>=tonumber(ARGV[i+1]) or c[i+1]>=tonumber(ARGV[i+2]) then result=1
 else
  for j=i,i+1 do c[j]=redis.call('INCR',KEYS[j]);redis.call('EXPIRE',KEYS[j],172800) end
  redis.call('SET',KEYS[5],'1','EX',172800)
 end
end
return {result,c[1],c[2],c[3],c[4]}`;
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Avatar-Revision':'image-status-1'}});
const valid=(s,n)=>typeof s==='string' && s.trim() && s.length<=n;
export async function avatarCloud(ctx,action,transport=fetch){
  const {request}=ctx,env={...process.env,...ctx.env};
  const post=action!=='status';
  if(request.method!==(post?'POST':'GET'))return json(405,{error:'Method not allowed'});
  if(post && (!['https://apps-demo.muyang23333.top'].includes(request.headers.get('origin')) || !request.headers.get('content-type')?.startsWith('application/json')))return json(403,{error:'请从作品集页面发起请求。'});
  const p=createProviders(env,transport),url=env.AVATAR_REDIS_REST_URL||env.UPSTASH_REDIS_REST_URL,token=env.AVATAR_REDIS_REST_TOKEN||env.UPSTASH_REDIS_REST_TOKEN;
  const hasStore=!!(url?.startsWith('https://')&&token),ip=ctx.clientIp;
  const limits=['CHAT_DAILY_PER_VISITOR','CHAT_DAILY_GLOBAL','IMAGE_DAILY_PER_VISITOR','IMAGE_DAILY_GLOBAL'].map((s,i)=>{const n=Number(env['AVATAR_'+s]??[12,100,1,5][i]);return Number.isSafeInteger(n)&&n>=0?n:0});
  const day=Math.floor((Date.now()+28800000)/86400000);
  const snapshot=c=>({resetAt:new Date((day+1)*86400000-28800000).toISOString(),...Object.fromEntries(['chat','image'].map((k,j)=>[k,{limit:limits[j*2],remaining:Math.max(0,limits[j*2]-c[j*2]),globalRemaining:Math.max(0,limits[j*2+1]-c[j*2+1])}]))});
  const fallback=snapshot([0,0,0,0]);
  let live={chat:false,image:false},quota=fallback;
  const configured={chat:p.live.chat,image:p.live.image,quotaStore:hasStore};
  try{
    let b={},input;
    if(post){
      if(Number(request.headers.get('content-length'))>48000)return json(413,{error:'消息太长'});
      const raw=await request.text();if(raw.length>48000)return json(413,{error:'消息太长'});
      try{b=JSON.parse(raw)}catch{return json(400,{error:'无效消息'})}
      if(!b||!uuid.test(b.requestId)||!(action==='chat'?valid(b.message,1000):valid(b.prompt,600)&&b.confirm===true))return json(400,{error:'无效请求'});
      const h=b.history??[];if(!Array.isArray(h)||h.length>6||!h.every(m=>m&&['user','assistant'].includes(m.role)&&valid(m.content,1800)))return json(400,{error:'无效对话记录'});
      input={lang:b.lang==='en'?'en':'zh',history:h,message:b.message,prompt:b.prompt,allowImage:true,
        pageRoute:action==='image'&&['qwen','standard','ipv4'].includes(b.pageRoute)?b.pageRoute:undefined};
    }
    if(hasStore && typeof ip==='string'&&isIP(ip)){
      const hash=createHmac('sha256',token).update(day+':'+ip).digest('hex'),k='avatar:v1:{'+day+'}:';
      const idx=post&&p.live[action]?(action==='image'?3:1):0;
      const keys=[k+'c:'+hash,k+'chat',k+'i:'+hash,k+'image',k+action+':'+hash+':'+(b.requestId||'status')];
      const resp=await transport(url,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',lua,'5',...keys,idx,...limits]),signal:AbortSignal.timeout(4500)});
      const arr=(await resp.json()).result;if(!resp.ok||!Array.isArray(arr)||arr.length!==5||!arr.every(Number.isSafeInteger))throw Error('quota unavailable');
      live={...p.live};quota=snapshot(arr.slice(1));
      if(arr[0])return json(arr[0]===2?409:429,{error:arr[0]===2?'这次请求已经处理，不会重复扣费。':'今日次数已用完。',quota});
    }
    if(!url&&!token&&typeof ip==='string'&&isIP(ip)){
      const arr=lightLimit(day,ip,post&&p.live[action]?action:null,b.requestId,limits);
      live={...p.live};quota=snapshot(arr.slice(1));
      if(arr[0])return json(arr[0]===2?409:429,{error:arr[0]===2?'这次请求已经处理，不会重复扣费。':'本次访问次数已用完，请稍后再试。',quota});
    }
    if(!post){
      // On demand only; fixed official model metadata URL, never a generation.
      let imageAccess,pageRoute;
      if(new URL(request.url).searchParams.get('check')==='image'){
        if(live.image)imageAccess=await p.imageRoutes();
        pageRoute=imageAccess?.status==='MODEL_VISIBLE'?imageAccess.route:live.image&&p.imageProviders.qwen?'qwen':'none';
      }
      return json(200,{live,configured,quota,pageRoute,imageAccess:imageAccess?.status,imageRoutes:imageAccess?.checks,imageProviders:p.imageProviders,protection:hasStore?'shared':(!url&&!token?'instance':'unavailable')});
    }
    if(!live[action])return action==='chat'?json(200,{...demoReply(input),quota}):json(503,{error:'生图服务暂未启用，没有调用模型。',quota});
    const result=await p[action](input);
    if(result.imagePrompt && (!live.image||!quota.image.remaining||!quota.image.globalRemaining))return json(429,{error:'生图尚未启用或今日次数已用完。',quota});
    return json(200,{...result,quota});
  }catch(e){
    if(!post)return json(200,{live:{chat:false,image:false},configured,quota:fallback});
    if(knownImageFailure(e?.code)||['QWEN_IMAGE_ERROR','PROVIDER_TIMEOUT','PROVIDER_UNAVAILABLE','INVALID_REPLY','IMAGE_REJECTED','IMAGE_NOT_CONFIGURED','INVALID_INPUT'].includes(e?.code)){
      return json(e.status,{error:e.message,code:e.code,quota});
    }
    return json(503,{error:'服务暂不可用，请稍后再试。没有自动重试。',quota});
  }
}
