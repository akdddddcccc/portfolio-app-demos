// Deliberately project only visitor-visible fields. Never send raw project
// records (legacy URLs, iframes, other file metadata), chats, or private files.
import {projects,posters} from "./catalog.mjs";
import { content } from "./profile.mjs";
// Visitor-safe editorial extracts. Source: Muyang-Career, CareerDB/02_Education.md
// and 03_Work_Experience.md at 443368c. Never load the private repository at runtime.
const career = {
  zh:"在 ClassIn / NOBOOK，沐阳做过直播贴片的字体和纹理设计，也和 UI 团队一起把界面里的视觉元素用到直播画面里。在河南中天高科智慧研究院，他参与过智慧收费站设备的造型和系列花纹设计，以及企业 Logo 的视觉升级。",
  en:"At ClassIn / NOBOOK, Muyang designed typography and textures for livestream graphics, adapting interface elements with the UI team. At Henan Zhongtian, he contributed to the form and surface patterns of toll-station equipment and a corporate logo refresh."
};

// Short editorial notes transcribed from the corresponding public story pages.
const more = {
  "poster-collection": {
    keywords: "海报 合集 平面 在此交汇 弘益大学 贴覆在 2 米 招贴 posters gallery typography where we meet overlaid",
    zh: posters.map(p => "《" + p.title.zh + "》：" + p.setting.zh + "。" + p.description.zh).join(" "),
    en: posters.map(p => p.title.en + " (" + p.setting.en + "). " + p.description.en).join(" ")
  },
  yuanbai: {
    keywords: "元白 北师大 建筑 游戏 agent 游戏设计 ai设计 gamification campus architecture ai game campus map",
    zh: "探索游戏让访客主动发现元白楼；对话 Agent 让访客直接向建筑提问。沐阳参与了对话技术验证、网页搭建、游戏 UI 升级、Agent 语料库、Logo 和排名系统；玩法、动画、三维模型和汇报是团队协作的成果。",
    en: "The game invites exploration of Yuanbai Building; the agent lets visitors speak to the building. Muyang contributed to validating conversation technology, web implementation, game UI, the agent corpus, logo and ranking system. Gameplay, animation, 3D models and presentation were team efforts."
  },
  "guandan-poker": {
    keywords: "掼蛋 惯蛋 纸牌 棋牌 扑克 记分 计分 积分板 冲a 牌盒 guandan poker cards scoreboard packaging",
    zh: "两副牌以颜色区分，方便玩完以后重新分拣；积分板和棋子把当前级牌与冲 A 次数摆到桌面上。这是一套把牌、计分和收纳一起考虑的设计。",
    en: "Colour distinguishes two decks so they can be sorted again. A score board and markers show the current level and attempts at A. Cards, scoring and storage were designed together."
  },
  "water-court": {
    keywords: "篮球 球场 苏博 园林 水庭 半场 投篮 basketball half court garden museum",
    zh: "水院球场是进行中的空间概念，归在「其他」，不是工业产品。半场以轻对抗、重娱乐为主，水庭受苏州博物馆启发；图像是 AI 辅助的概念可视化，并非馆方委托或已建成的场地。",
    en: "Water Court is a spatial concept in progress, filed under Other rather than industrial products. Its half court is for casual play and spectators. The water garden is inspired by Suzhou Museum; these AI-assisted studies are not a museum commission or a built site."
  },
  "focus-filter": { keywords: "虚焦 虚化 模糊 滤镜 摄影 照片 去色 focus defocus blur photography filter" },
  "ai-mcp-workflow": { keywords: "直播 贴纸 贴图 生图 sticker live stream image generation" },
  "task-map-prototype": { keywords: "甘特 任务 规划 思维导图 gantt tasks mind map" },
  shaker: { keywords: "社交 灯具 气氛 shaker conversation luminaire" },
  "cloud-form": { keywords: "点云 颗粒 粒子 cloud particles point cloud" },
};
const category = {visual:"视觉 视觉设计 graphic visual",product:"产品 工业设计 industrial product",ui:"ui 界面 interface",others:"", "vibe-coding":"vibe coding 代码 网页工具"};
const records = projects.filter(p=>!p.closed && p.discipline!=="unpublished" && /^[a-z\d-]+$/.test(p.slug)).map(p=>({
  slug:p.slug,title:p.title,discipline:p.discipline,category:category[p.discipline]||"",
  zh:[p.details?.zh?.description,more[p.slug]?.zh].filter(Boolean).join(" "),
  en:[p.details?.en?.description,more[p.slug]?.en].filter(Boolean).join(" "),
  keywords:[p.slug,more[p.slug]?.keywords,...(p.tags||[]).map(t=>t.zh+" "+t.en)].filter(Boolean).join(" ").toLowerCase(),
}));
const bySlug=new Map(records.map(p=>[p.slug,p]));
const stop=new Set("设计 项目 作品 详细 知道 一个 什么 哪个 介绍 一个 详细 了解 design project about with from what have you your tell more work the and how".split(" "));
const segmenter=new Intl.Segmenter("zh",{granularity:"word"});
function terms(text){
  const str=String(text||"").toLowerCase().slice(0,1500);
  return [...new Set([...segmenter.segment(str)].map(t=>t.segment).filter(t=>/[\p{L}\p{N}]/u.test(t)&&t.length>=2&&!stop.has(t)))];
}
function score(r,query){
  const title=(r.title.zh+" "+r.title.en+" "+r.slug).toLowerCase();
  const desc=(r.zh+" "+r.en).toLowerCase();
  // Tokenisers can split proper names such as 元白 into two one-character
  // tokens; search explicit Chinese alias phrases before ordinary word overlap.
  const lower=query.toLowerCase();
  const exact=r.keywords.split(/\s+/).some(a=>a.length>=2&&/\p{Script=Han}/u.test(a)&&lower.includes(a));
  return terms(query).reduce((n,t)=>n+(title.includes(t)?7:0)+(r.keywords.includes(t)?5:0)+(r.category.includes(t)?3:0)+(desc.includes(t)?1:0),exact?10:0);
}
export function findNotes(message,history=[]){
  const result=query=>records.map(r=>[r,score(r,query)]).filter(e=>e[1]>0).sort((a,b)=>b[1]-a[1]);
  let matches=result(message);
  if(!matches.length && /再|具体|这个|那个|多讲|继续|上面|它|more|detail|that|this|its|why/i.test(message)){
    const last=history.filter(m=>m?.role==="user").at(-1);
    if(last) matches=result(last.content);
  }
  return matches.slice(0,4).map(m=>m[0]);
}
const featured=["yuanbai","guandan-poker","water-court"].map(k=>bySlug.get(k));
export function curatedLinks(slugs,lang) {
  return [...new Set(Array.isArray(slugs)?slugs:[])].map(s=>bySlug.get(s)).filter(Boolean).slice(0,3)
    .map(r=>({slug:r.slug,title:r.title[lang]}));
}
export function contextFor(message,history,lang){
  const picks=findNotes(message,history);
  return JSON.stringify({
    author:content.about.zh.sections.map(s=>s.body).join("\n"),
    professionalExperience:career[lang],publicContacts:content.contact.items,
    // The catalogue makes comparison and navigation possible even when a
    // visitor uses a synonym that the local retrieval didn't recognise.
    projects:records.map(r=>({slug:r.slug,title:r.title[lang],discipline:r.discipline,summary:(r[lang]||"").slice(0,420)})),
    relevant:picks.map(r=>r.slug),
  });
}
export function demoReply({message,history=[],lang="zh"}){
  const en=lang==="en";
  let notes=findNotes(message,history);
  let text;
  if (/(?:帮我|给我|请|直接)(?:画|生(?:成)?|做)(?:一[张幅个])?(?:图|海报|邀请卡)|(?:generate|draw|make) (?:me )?(?:an? )?(?:image|poster|invitation)/i.test(message)) {
    notes=[]; text=en?"This local-notes session has no chat model to interpret an image brief.":"当前是本地资料模式，没有连接用于理解画面描述的对话模型。";
  } else if(/微信|wechat|邮箱|email/i.test(message)){
    const item=content.contact.items.find(i=>i.label===(/微信|wechat/i.test(message)?"WeChat":"Email"));
    notes=[];text=item.label+"："+item.value;
  } else if(/报价|档期|报酬|电话|签约|找你合作|联系本人|联系方式|\b(price|quote|available|availability|contact|hire|phone|budget)\b/i.test(message)){
    text=en?"The AI guide cannot confirm a fee, availability or a collaboration on Muyang’s behalf. Use the email or WeChat on this page to contact him directly.":"报价、档期和具体合作需要沐阳本人确认。你可以直接用本页的邮箱或微信联系他。";
    notes=[];
  } else if(/私人|隐私|住址|家庭住址|感情状况|家人|home address|relationship status/i.test(message)){
    notes=[];text=en?"That isn’t in his public profile.":"这部分不在沐阳公开的个人介绍里，我不替他推测。";
  } else if(/爱好|兴趣|设计之外|业余|平时喜欢|hobb|outside design|free time/i.test(message)){
    notes=[];text=en?"His public profile lists rap, basketball and photography, including product photography.":"沐阳公开写过的兴趣有 Rap、篮球和摄影，摄影里也包括产品摄影。";
  } else if(/就读|读研|在哪.*(读|上学)|北师大|哪.*大学|硕士|本科|研究生|where.*study|graduate student/i.test(message)){
    notes=[];text=content.about[lang].sections[0].body;
  } else if(/职业|经历|工作背景|做过什么工作|实习|工作过|任职|设计背景|学历|学什么|design background|work experience|education|career/i.test(message)){
    notes=[];text=(en?content.about.en.sections[0].body:content.about.zh.sections[0].body)+" "+career[lang];
  } else if(/(?:哪些|有没有|看看|推荐|有什么|any|show|which|recommend)/i.test(message) && /视觉|平面|工业产品|工业设计|界面|\bUI\b|visual design|graphic design|industrial design|vibe coding/i.test(message)){
    const kind=/视觉|平面|visual|graphic/i.test(message)?"visual":/工业|industrial/i.test(message)?"product":/vibe coding/i.test(message)?"vibe-coding":"ui";
    notes=records.filter(r=>r.discipline===kind).slice(0,3);
    text=en?"Here are some projects in that category. Open a title below to explore it.":"可以先看这几件，点作品名就能直接进入详情。";
  } else if(/你是谁|介绍一下自己|你的背景|你的专业|你擅长什么|who (are you|is muyang)|your background|your skills/i.test(message)){
    text=en?"I’m Chen Muyang’s AI portfolio guide. His public introduction connects industrial design with digital tools such as Figma, Rhino, KeyShot, Arduino and TouchDesigner. I can help you explore what that looks like in his projects.":"我是陈沐阳的 AI 作品导览。沐阳在江南大学学习工业设计，公开简介里的工具从 Rhino、KeyShot 到 Figma、Arduino 和 TouchDesigner。你可以挑一件作品，看看这些工具如何落到设计里。";
    notes=featured;
  } else if(/看看陈沐阳的作品|show me chen muyang[’']s work/i.test(message)){
    notes=featured; text=en?"Start with these three projects to explore Muyang’s interactive, visual and spatial work.":"可以从这三件开始看：感知元白是交互体验，掼蛋是牌具和视觉设计，水院球场是进行中的空间概念。";
  } else if(notes.length) {
    const first=notes[0];
    text=(more[first.slug]?.[lang]||first[lang]||first.title[lang]);
    if(!text.startsWith(first.title[lang])) text=first.title[lang]+(en?" — ":"：")+text;
    notes=notes.slice(0,1);
  } else if(/作品|项目|开始|推荐|你好|hello|start|portfolio|recommend|projects|works/i.test(message)){
    notes=featured; text=en?"For play and AI, start with Sensing Yuanbai. For a physical design you can try in the browser, look at Guandan. For a spatial concept, visit Water Court.":"想看游戏和 AI，可以先看《感知元白》；想看能在网页里上手的实物设计，可以看掼蛋牌具；对空间设计感兴趣，可以从《水院球场》开始。";
  } else {
    notes=[]; text=en?"The local preview only has public portfolio notes. Try asking about Sensing Yuanbai, Guandan or Water Court.":"本地资料预演只会从已公开的作品说明里找答案。可以试试问「感知元白的游戏和 Agent 各做什么」或「掼蛋为什么需要积分板」。";
  }
  return {text,links:curatedLinks(notes.map(r=>r.slug),lang),mode:"demo"};
}
