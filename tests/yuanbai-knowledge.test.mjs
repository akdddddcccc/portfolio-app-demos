import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCuratedKnowledgeContext,
  getCuratedStudentNameAnswer,
  getCuratedStudentRosterCounts,
} from "../edge-functions/_shared/yuanbai-knowledge.js";

test("retrieves verified Yuanbai building history", () => {
  const context = buildCuratedKnowledgeContext("元白楼为什么有十五个盒子？");
  assert.match(context, /公开核验资料/);
  assert.match(context, /15个独立方形盒子/);
});

test("retrieves public school projects", () => {
  const context = buildCuratedKnowledgeContext("学院以前做过哪些PBL项目和展览？");
  assert.match(context, /科技赋能传统文化/);
  assert.match(context, /未来驿站/);
});

test("keeps student anecdotes labeled as internal oral material", () => {
  const context = buildCuratedKnowledgeContext("郭皓彦是谁？");
  assert.match(context, /内部口述资料/);
  assert.match(context, /融媒体中心影像部副部长/);
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
});

test("looks up the submitted roster locally and corrects same-sound name recognition", () => {
  assert.deepEqual(getCuratedStudentRosterCounts(), {
    "26级1班": 34,
    "26级2班": 33,
    "26级3班": 36,
  });
  const answer = getCuratedStudentNameAnswer("你知道朱玉洁吗");
  assert.match(answer, /^朱煜杰在26级3班。/);
  assert.doesNotMatch(answer, /合成|测试|名单|记录性别/);
  assert.match(getCuratedStudentNameAnswer("陈默阳是几班"), /^陈沐阳在26级1班。/);
});

test("recognizes the official Academy Cats project without inventing individual cats", () => {
  const context = buildCuratedKnowledgeContext("学院猫是什么项目？");
  assert.match(context, /学院猫.*纪念文创设计/);
  assert.match(context, /小灯、如意、小海绵/);
  assert.match(context, /如意和小海绵已被收养/);
  assert.match(context, /三位猫学长/);
  assert.match(context, /没有三位的辨认特征/);
});

