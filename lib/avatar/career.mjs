// Reviewed public extracts, not a mirror. Source: CareerDB/{02_Education,
// 03_Work_Experience,04_Projects,05_Skills} at 443368c0e75af3fb30a9da9bfff299a51963ff3e.
// Recheck 09_Verification_TODO before extending. No raw files, interview notes,
// non-public clients, private links, internal images, estimates or access credentials.
export const careerEdition='public-cases-1';
const cases = [
  ['ClassIn / NOBOOK', ['classin','nobook','直播视觉','直播贴片','直播间','livestream graphics'], 'ai-mcp-workflow',
    '视觉设计实习：先研究教育直播案例，再按播出位置设计顶部、侧边、底部贴片，以及人物介绍和活动物料。同一套字和纹理换到侧边窄画幅时，要重新安排信息层级、留白和装饰密度，不是简单缩小。与 UI 团队协作，把既有界面元素转成直播视觉。',
    'Visual design internship: studied education livestreams and designed top, side and bottom overlays, speaker introductions and event graphics. A narrow side panel required rebalancing type, negative space and decoration, not simply shrinking the top banner. He worked with the UI team to adapt existing interface elements.'],
  ['河南中天高科智慧研究院 / Henan Zhongtian', ['中天','收费站','发卡机','缴费机','etc','zhongtian','toll station'], '',
    '参与智慧收费站系列设备的造型与表面花纹设计，涉及自助发卡机、自助缴费机、智能岛头与岛尾、ETC 特情处理一体机。另参与企业 Logo 视觉升级，用 Photoshop 处理宣传册产品图与标识，并参与宣传视频的录制、素材整理和剪辑。这些是协作贡献，不能说整套设备由他独立设计或已量产。',
    'Contributed to the form and surface patterns of a family of toll-station devices: ticket dispensers, payment terminals, traffic-island end units and ETC exception-handling terminals. Also helped refresh the corporate logo, prepared product and logo images for brochures in Photoshop, and helped film, organise and edit promotional footage. These were collaborative contributions, not claims of sole authorship or production.'],
  ['直播间贴片生成器 / Livestream overlay workflow', ['贴片生成器','贴片流水线','单张返修','贴片工具','overlay workflow','sticker generator'], 'ai-mcp-workflow',
    '从实习中反复遇到的贴片需求出发，把参考图拆成可复用的视觉规则。例如参考图有人物和促销大字，并不照搬，而是提取光带、颗粒、几何线条作为背景，让出直播文字的位置。为顶贴、侧贴、底贴分别定构图规则，把生成、审核、单张返修和导出串成网页流程，最终将可复用素材整理进 Figma。',
    'Turned recurring internship briefs into a web workflow. Rather than copying people or promotional text from a reference, he translated it into light bands, grain and geometric lines, leaving room for live text. Defined separate layout rules for top, side and bottom overlays and connected generation, review, individual revisions, export and reuse in Figma.'],
  ['Task Map', ['task map','taskmap','任务甘特图','甘特图','任务工作台','gantt'], 'task-map-prototype',
    '把思维导图的任务拆解接到甘特图的时间编排上：AI 只为选中节点建议下一层子任务和粗略日期，用户可以增删、锁定时间、拖动任务条并处理父子任务时间冲突。交付了可操作的原型，可导出阅读用 PDF 或无需服务器即可打开的交互 HTML。沐阳定义需求与交互、迭代提示词、审核 AI 生成的代码并验收功能。',
    'Connected mind-map planning to a Gantt timeline. AI suggests only one level of children and rough dates for the selected node; users can edit tasks, lock dates, drag bars and resolve parent–child date conflicts. The working prototype exports a reading PDF or a standalone interactive HTML file. Muyang defined requirements and interactions, iterated prompts, reviewed AI-generated code and tested the result.'],
  ['Task Divide', ['task divide'], 'task-map-prototype',
    'Task Map 之前的探索。用 React、TypeScript 和 Vite 做层级任务管理，记录起止时间与依赖，校验子任务不越过父任务时间范围，用颜色区分甘特图层级。可浏览的作品集案例是后续的 Task Map，不是早期工具本身。',
    'An earlier exploration preceding Task Map: a React, TypeScript and Vite tool for nested tasks, dependencies, parent–child date validation and colour-coded Gantt levels. The portfolio link shows the later Task Map, not a live copy of Task Divide.'],
  ['微信公众号设计师助理 / WeChat design assistant', ['微信公众号助理','公众号助理','陈默扬','wechat assistant','wechat design assistant'], '',
    '在公众号里设计文字、语音和图片可以接着聊的工作流。例如先发一张图，再发语音说怎么改，系统把转写后的要求关联到最近的图片。还处理了连续短消息合并、取消旧任务和导出文档。它是独立于本页作品集分身的另一个项目。',
    'Designed a WeChat workflow connecting text, voice and images. A visitor can send a picture and then speak the edits; the transcript is associated with the recent image. Also handled merging short messages, cancelling superseded tasks and exporting documents. This is separate from the portfolio guide on this page.'],
  ['CareerOS', ['careeros','职业资产','简历系统','resume system'], '',
    '将旧简历、作品与项目记录整理成可维护的职业事实库，区分已确认经历、待核实信息与方案演练。为岗位定制设计了一套流程：读岗位要求、选有证据的经历、经授权后生成 Figma 简历。',
    'Organised past CVs and project records into a maintainable source of career facts, separating verified work from unconfirmed claims and exercises. Designed a workflow to read a job description, select supported examples and, with permission, produce a tailored Figma résumé.'],
  ['啥都友 / Shadouyou', ['啥都友','校园配送','shadouyou'], '',
    '本科期间为校园配送平台“啥都友”设计 Logo。可以介绍的是标志设计，不把平台运营或业务规模当成他的设计成果。',
    'Designed the logo for the campus delivery platform Shadouyou as an undergraduate. The contribution was the identity mark, not operating the platform.'],
  ['地下八英里 / Underground 8 Mile', ['地下八英里','说唱比赛','underground 8 mile'], '',
    '本科期间参与大学生说唱比赛的主视觉方向探索，出了海报方案并整理宣传物料。方案未被采用，可以作为理解需求的复盘案例，不能作为赛事正式上线的主视觉。',
    'Explored key visuals for a student rap competition, produced poster proposals and organised promotional material. The proposal was not adopted; this is a brief-interpretation case, not the official campaign.'],
  ['个人作品集 / Portfolio', ['个人作品集网站','个人网站','portfolio website'], '',
    '负责作品集的信息架构、视觉设计、前端实现和持续迭代，把工业设计、品牌视觉与 AI 工具整理成可浏览的案例。开发中用 AI 辅助，自己审核代码、验收交互和视觉，并处理构建、路由和发布。',
    'Owned the portfolio’s information architecture, visual design, frontend and iterations, organising industrial, visual and AI work into browsable cases. Used AI assistance, reviewed code, checked interactions and visuals, and handled build, routing and release issues.'],
];
export function publicCareerCases(lang) {
  return cases.map(([topic,,slug,zh,en])=>({topic,details:lang==='en'?en:zh,...(slug?{project:slug}:{})}));
}
export function matchCareerCase(query,lang){
  const s=query.toLowerCase();
  const hits=cases.map(([,aliases],i)=>[i,Math.max(0,...aliases.filter(a=>s.includes(a)).map(a=>a.length))])
    .filter(([,score])=>score).sort((a,b)=>b[1]-a[1]);
  return hits.length?publicCareerCases(lang)[hits[0][0]]:undefined;
}
