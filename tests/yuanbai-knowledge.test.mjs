import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCuratedKnowledgeContext,
  getCuratedStudentNameAnswer,
  getCuratedStudentRosterFallback,
  getCuratedStudentRosterCounts,
  YUANBAI_SYSTEM_PROMPT,
} from "../edge-functions/_shared/yuanbai-knowledge.js";

test("accepts homophone forms of Yuanbai without correcting the speaker", () => {
  assert.match(YUANBAI_SYSTEM_PROMPT, /语音转写若把“元白”写成“袁白”/u);
  assert.match(YUANBAI_SYSTEM_PROMPT, /不向用户解释转写或纠正用字/u);
  assert.doesNotMatch(YUANBAI_SYSTEM_PROMPT, /我猜你想问的是元白/u);
});

test("retrieves verified Yuanbai building history", () => {
  const context = buildCuratedKnowledgeContext("元白楼为什么有十五个盒子？");
  assert.match(context, /元白楼改造的设计故事与空间策略/);
  assert.match(context, /15个独立方形盒子/);
  assert.doesNotMatch(context, /来源：|公开核验资料/);
});

test("retrieves public school projects", () => {
  const context = buildCuratedKnowledgeContext("学院以前做过哪些PBL项目和展览？");
  assert.match(context, /科技赋能传统文化/);
  assert.match(context, /未来驿站/);
});

test("keeps student anecdotes labeled as internal oral material", () => {
  const context = buildCuratedKnowledgeContext("郭皓彦是谁？");
  assert.match(context, /内部口述：同学与校园角色/);
  assert.match(context, /融媒体中心影像部副部长/);
  assert.doesNotMatch(context, /来源：|内部口述资料/);
});

test("retrieves room functions instead of only listing building spaces", () => {
  const context = buildCuratedKnowledgeContext("分组讨论教室和联想实验室分别怎么使用？");
  assert.match(context, /分组讨论室配有多组桌椅和显示器/);
  assert.match(context, /媒体互动教学与远程会议/);
  assert.match(context, /支持听课、集体讨论和工作/);
});

test("recognizes Gao dean title and keeps the faculty biography retrievable", () => {
  const context = buildCuratedKnowledgeContext("高院长的研究方向和教育经历是什么？");
  assert.match(context, /高鹏/);
  assert.match(context, /艺术设计思维/);
  assert.match(context, /中央美术学院/);
});

test("retains the design-thinking model and design outcomes in retrieval", () => {
  const thinking = buildCuratedKnowledgeContext("艺术设计思维模型如何从表达走向选择，再由关系走向创作？");
  assert.match(thinking, /发现|表达|选择/);
  assert.match(thinking, /原型|测试|创作/);
  const outcomes = buildCuratedKnowledgeContext("学院的设计项目、展览和课程成果有哪些？");
  assert.match(outcomes, /科技赋能传统文化/);
  assert.match(outcomes, /未来驿站/);
  const educationLab = buildCuratedKnowledgeContext("设计与教育实验室有哪些项目？", 3);
  assert.match(educationLab, /未来驿站/);
});

test("looks up the submitted roster locally and corrects same-sound name recognition", () => {
  assert.deepEqual(getCuratedStudentRosterCounts(), {
    "26级1班": 34,
    "26级2班": 33,
    "26级3班": 36,
  });
  const answer = getCuratedStudentNameAnswer("你知道朱玉洁吗");
  assert.match(answer, /^朱煜杰在26级3班。/);
  assert.doesNotMatch(answer, /祝你/);
  assert.match(answer, /设计|生活|红点|iF/u);
  assert.match(getCuratedStudentNameAnswer("你知道陈沐阳吗"), /^陈沐阳在26级1班。/);
  assert.match(getCuratedStudentNameAnswer("你认识郭小红吗"), /^郭小红在26级1班。/);
  assert.match(getCuratedStudentNameAnswer("你认识郭小红吗"), /她/);
  assert.equal(getCuratedStudentNameAnswer("陈默阳是几班"), "陈沐阳在26级1班。");
  assert.doesNotMatch(answer, /合成|测试|名单|记录性别/);
});

test("uses only the named classmate's consented anecdote on personal-name questions", () => {
  const queryAnswers = [
    ["你知道何任选吗", /26级1班.*设院库里/u],
    ["你认识朱玉洁吗", /26级3班.*帅/u],
    ["郭皓彦是谁", /26级1班.*粤语/u],
    ["你知道董帅吗", /26级1班.*儒雅/u],
    ["你知道何嘉欢吗", /26级1班.*大眼睛/u],
    ["你知道陈欢吗", /26级1班.*思想/u],
    ["你知道唐业刚吗", /唐业钢在26级2班.*软软糯糯/u],
    ["你知道陈琛吗", /26级1班.*篮球/u],
  ];
  for (const [query, expected] of queryAnswers) {
    assert.match(getCuratedStudentNameAnswer(query), expected, query);
  }
  assert.equal(getCuratedStudentNameAnswer("何任选是几班"), "何任选在26级1班。");
  assert.equal(getCuratedStudentNameAnswer("陈琛几班"), "陈琛在26级1班。");
});

test("unknown classmates and teachers use a safe class fallback without throwing", () => {
  assert.equal(
    getCuratedStudentRosterFallback("你知道不存在的同学吗"),
    "这个名字我没对上，怕说错班级，先不猜了。",
  );
  assert.equal(
    getCuratedStudentRosterFallback("刘老师是几班"),
    "老师不在这届学生里，我就不把老师分到这三个班了。",
  );
});

test("recognizes the official Academy Cats project without inventing individual cats", () => {
  const context = buildCuratedKnowledgeContext("学院猫是什么项目？");
  assert.match(context, /学院猫.*纪念文创设计/);
  assert.match(context, /小灯、如意、小海绵/);
  assert.match(context, /如意和小海绵已被收养/);
  assert.match(context, /三位猫学长/);
  assert.match(context, /Dream Catcher/);
  assert.match(context, /小灯阳光开朗/);
  assert.match(context, /不等于真实猫的性格或行为/);
});

