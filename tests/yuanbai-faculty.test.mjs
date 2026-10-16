import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../edge-functions/_shared/yuanbai-faculty-data.js';
import {buildFacultyKnowledgeContext, retrieveFaculty} from '../edge-functions/_shared/yuanbai-faculty-knowledge.js';
import {personSubject} from '../edge-functions/_shared/yuanbai-person-query.js';
import {chat} from '../edge-functions/api/yuanbai/chat.js';
test('all official faculty resolve to their own sourced profile, including guests and PBL mentors',()=>{
 assert.equal(data.profiles.length,52);
 for(const p of data.profiles){
  assert.equal(personSubject(`${p.name}研究什么`),p.name);
  const context=buildFacultyKnowledgeContext(`${p.name}研究什么`);
  assert.ok(context.includes(p.source_url));assert.ok(context.includes(p.summary));
  assert.ok(context.length<24000);
 }
 const roster=buildFacultyKnowledgeContext('学院教师名单');
 for(const p of data.profiles) assert.ok(roster.includes(p.name));
 assert.match(roster,/客座导师：陈晨/);assert.match(roster,/PBL导师：王传东/);
});
test('paper evidence distinguishes reviewed research, bibliography and missing titles',()=>{
 const context=buildFacultyKnowledgeContext('胡清清的苗族蜡染研究');
 assert.match(context,/CMBP-9/);assert.match(context,/LCM/);assert.match(context,/文化传承成效/);
 assert.match(buildFacultyKnowledgeContext('范圣玺论文'),/未列具体题名，不代表无论文/);
 assert.match(buildFacultyKnowledgeContext('高鹏论文'),/仅官网题录，外部内容未核实/);
 assert.equal(data.publications.length,125);
 assert.equal(data.publications.filter(p=>p.research_summary).length,15);
 for(const p of data.publications.filter(p=>p.research_summary))assert.ok(p.source_url&&p.limitations&&p.review_level);
 assert.ok(retrieveFaculty('有哪些老师研究苗族蜡染').some(p=>p.name==='胡清清'));
});
test('new faculty context reaches chat generation and corpus telemetry without claiming live search',async t=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.match(String(url),/chat\/completions$/);
  const payload=JSON.parse(options.body);
  assert.match(payload.messages[1].content,/胡清清/);assert.match(payload.messages[1].content,/并非实时官网检索/);
  return Response.json({choices:[{message:{content:'她的研究包含数字文化遗产与多模态感知。'}}]});
 });
 const r=await chat('胡清清研究方向是什么',[],'test');
 assert.equal(r.webSearchAttempted,false);assert.deepEqual(r.researchStages,[{stage:'corpus',status:'hit'}]);
});
