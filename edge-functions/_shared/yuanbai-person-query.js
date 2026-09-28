import { pinyin } from 'pinyin-pro';
// Canonical spelling only, not a biography. Hara's name verified 2026-09-28:
// https://hara.ndc.co.jp/cn/about/
const PUBLIC_NAMES=['原研哉','高鹏','李飞飞','詹震宇','刘亚明','徐腾飞'];
export function normalizePublicPersonQuery(query) {
  const text=String(query||'');
  if(/同学|学生|几班|班级/u.test(text))return text;
  const name=personSubject(text);
  if(!name)return text;
  const sound=pinyin(name,{toneType:'none'});
  const matches=PUBLIC_NAMES.filter(candidate=>pinyin(candidate,{toneType:'none'})===sound);
  return matches.length===1?text.replace(name,matches[0]):text;
}
// Extract a name from conversational identity questions, not just one fixed phrase.
export function personSubject(query) {
  const text=String(query||'').replace(/\s+/gu,'').replace(/[？?。！!，,]/gu,'');
  if (/(高院长|高院|高鹏)/u.test(text)) return '高鹏';
  for(const name of ['詹震宇','刘亚明','徐腾飞'])if(text.includes(name))return name;
  const match=text.match(/^(?:元白(?:老师)?|请问|那|那么)*(?:你)?(?:认不认识|知不知道|知道不知道|有没有听说过|听说过|是否认识|认识|认得|知道|介绍一下|说说|讲讲)([\p{Script=Han}·]{2,8}?)(?:这个人|这个设计师|这位设计师|老师|院长)?(?:吗|么|呢|啊|呀)?$/u)
    ||text.match(/^([\p{Script=Han}·]{2,8}?)是谁(?:呀|啊|呢)?$/u)
    ||text.match(/^([\p{Script=Han}·]{2,4}?)(?:最近|最新|目前)(?:的)?(?:研究|作品|项目|职务|经历)/u);
  return match?.[1]||'';
}
