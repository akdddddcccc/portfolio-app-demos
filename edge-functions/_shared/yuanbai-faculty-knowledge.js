import database from './yuanbai-faculty-data.js';
export const FACULTY_NAMES = database.profiles.map(p => p.name);
const normalize = text => String(text || '').toLowerCase().replace(/高院长|高院/gu, '高鹏');
const paperMap = new Map(database.publications.map(p => [p.id, p]));
const evidenceRule = '以下是2026-10-16采集核对的本地资料，并非实时官网检索。只按列明的证据回答；官网题录不能推导论文方法、发现或发表状态。未列论文不代表没有论文。客座和PBL导师不可称为专任教师。合作论文不等于教师独立完成。';
function score(query, terms) {
  return terms.reduce((sum, term) => sum + (query.includes(term.toLowerCase()) ? Math.max(2, term.length) : 0), 0);
}
export function retrieveFaculty(query, limit = 4) {
  const q = normalize(query);
  const named = database.profiles.filter(p => q.includes(p.name.toLowerCase()));
  const ranked = named.length ? named : database.profiles.map(p => ({p, score: score(q, p.topics) + p.publication_ids.reduce((n,id) => n + score(q, [paperMap.get(id).title,...(paperMap.get(id).research_topics || [])]),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.p);
  return ranked.slice(0,limit);
}
export function buildFacultyKnowledgeContext(query) {
  const q = normalize(query);
  const named = FACULTY_NAMES.some(n=>q.includes(n.toLowerCase()));
  if (!named && /师资|教师名单|团队所有|哪些老师|所有老师|学院.*老师/u.test(q) && !retrieveFaculty(q).length) {
    const groups = Object.groupBy ? Object.groupBy(database.profiles,p=>p.directory_group) : database.profiles.reduce((a,p)=>((a[p.directory_group] ||= []).push(p),a),{});
    const labels={prof:'教授',aprof:'副教授',fyjy:'副研究员',lecturer:'讲师',bshamzszmpx:'博士后',tutor:'客座导师',pbl:'PBL导师'};
    return evidenceRule+'\n官网目录共52人，分类为：\n'+Object.entries(groups).map(([k,ps])=>`${labels[k]||k}：${ps.map(p=>p.name).join('、')}`).join('\n')+'\n来源：'+database.roster_url;
  }
  const selected = retrieveFaculty(q);
  if (!selected.length) return '';
  return evidenceRule+'\n'+selected.map(p=>{
    const publications=p.publication_ids.map(id=>paperMap.get(id));
    const ranked=publications.map((paper,index)=>({paper,index,s:score(q,[paper.title,...(paper.research_topics||[])])})).sort((a,b)=>b.s-a.s||Number(Boolean(b.paper.research_summary))-Number(Boolean(a.paper.research_summary))||a.index-b.index);
    const count=selected.length===1?24:3;
    return `[${p.name}]\n${p.directory_label}\n${p.summary}\n研究方向：${p.topics.join('、')}\n来源：${p.source_url}\n官网题录线索${publications.length}条${publications.length?'':'（未列具体题名，不代表无论文）'}。\n`+ranked.slice(0,count).map(({paper:r})=>`《${r.title}》\n官网题录：${r.citation}\n证据：${r.status==='profile_only'?'仅官网题录，外部内容未核实':r.review_level}\n${r.publication_status?'官网发表状态：'+r.publication_status+'\n':''}${r.research_summary?'课题与方法：'+r.research_summary+'\n边界：'+r.limitations+'\n':''}${r.bibliographic_note||''}\n来源：${r.source_url||r.profile_url}${r.doi?' DOI:'+r.doi:''}`).join('\n');
  }).join('\n\n');
}
