import {projects,posters} from "./catalog.js";

// Resolve before any asynchronous model call: browsers only allow opening a
// new tab during the original button press / Enter event. Only local routes.
export function chatWorkTarget(message, lang='zh'){
  const q=message.toLowerCase().trim();
  if(!/看看|看一下|看一看|想看|给我看|打开|跳转|带我去|show me|let me see|take me to|\bopen\b/.test(q))return null;
  if(/不要|不用|别打开|不想看|为什么|怎么|如何|介绍|分析|设计思路|创作思路|帮我画|生成|新做|设计一|画一|做一|\b(why|how|explain|generate|draw|create)\b|don't|do not/.test(q))return null;
  const lng=lang==='en'?'en':'zh';
  const root='https://muyang23333.top/#/'+lng+'/';
  const match=t=>[t.zh,t.en].some(v=>v?.length>=2 && q.includes(v.toLowerCase()));
  const poster=posters.find(p=>match(p.title));
  if(poster)return {title:poster.title[lng],href:root+'project/poster-collection/'+poster.id+'?from=visual'};
  const available=projects.filter(p=>!p.closed&&p.discipline!=='unpublished');
  const exact=available.find(p=>match(p.title)||q.includes(p.slug));
  const alias=[[/海报|招贴|posters?/,'poster-collection'],[/感知元白|元白/,'yuanbai'],[/掼蛋|惯蛋/,'guandan-poker'],[/水院球场|水上球场/,'water-court']].find(([rx])=>rx.test(q));
  const work=exact||available.find(p=>p.slug===alias?.[1]);
  if(work)return {title:work.title[lng],href:root+'project/'+work.slug+'?from='+work.discipline};
  const group=[[/视觉设计|平面设计|visual design/,'visual','视觉设计','Visual design'],[/工业产品|工业设计|industrial design/,'product','工业产品设计','Industrial design'],[/界面设计|ui\s*设计|ui design/,'ui','UI 设计','UI design']].find(([rx])=>rx.test(q));
  if(group)return {title:group[lng==='zh'?2:3],href:root+'projects/'+group[1]};
  if(/(?:陈沐阳|你|他)的作品[吧吗呢？?。！!\s]*$|chen muyang[’']s work[s]?[?!.\s]*$/.test(q))return {title:lng==='zh'?'全部作品':'All projects',href:root+'projects/all'};
  return null;
}
