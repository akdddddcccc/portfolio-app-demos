import assert from "node:assert/strict";
import test from "node:test";
import { buildCuratedKnowledgeContext } from "../edge-functions/_shared/yuanbai-knowledge.js";

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

test("recognizes the official Academy Cats project without inventing individual cats", () => {
  const context = buildCuratedKnowledgeContext("学院猫是什么项目？");
  assert.match(context, /学院猫.*纪念文创设计/);
  assert.match(context, /三位猫学长/);
  assert.match(context, /仍无三位个体/);
});

