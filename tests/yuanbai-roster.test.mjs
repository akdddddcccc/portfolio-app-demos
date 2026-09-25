import assert from "node:assert/strict";
import test from "node:test";
import { findSyntheticRosterMatches, getSyntheticRosterAnswer, getSyntheticRosterFallback } from "../edge-functions/_shared/yuanbai-roster.js";

const roster = {
  synthetic: true,
  records: [
    { name: "陈沐阳", gender: "男", class: "26级1班" },
    { name: "李青", gender: "女", class: "26级2班" },
  ],
};

test("phonetic ASR typo resolves to the canonical roster name and class", () => {
  assert.deepEqual(findSyntheticRosterMatches("你知道陈默阳吗", roster), [
    { name: "陈沐阳", class: "26级1班" },
  ]);
  assert.equal(getSyntheticRosterFallback("陈默阳是几班", roster), null);
});

test("same-pronunciation characters resolve to the roster spelling, without exposing internal labels", () => {
  const rosterWithZhuyu = {
    synthetic: true,
    records: [{ name: "朱煜杰", gender: "男", class: "26级3班" }],
  };
  assert.deepEqual(findSyntheticRosterMatches("你知道朱玉洁吗", rosterWithZhuyu), [
    { name: "朱煜杰", class: "26级3班" },
  ]);
  const answer = getSyntheticRosterAnswer("你知道朱玉洁吗", rosterWithZhuyu);
  assert.match(answer, /^朱煜杰在26级3班。/);
  assert.doesNotMatch(answer, /测试|合成|记录|认识本人/);
});

test("exact names take priority and only include gender when asked", () => {
  assert.deepEqual(findSyntheticRosterMatches("你知道李青吗", roster), [
    { name: "李青", class: "26级2班" },
  ]);
  assert.deepEqual(findSyntheticRosterMatches("李青是什么性别", roster), [
    { name: "李青", class: "26级2班", gender: "女" },
  ]);
});

test("does not guess when phonetic correction has multiple plausible matches", () => {
  const ambiguousRoster = {
    ...roster,
    records: [
      ...roster.records,
      { name: "陈木阳", gender: "男", class: "26级2班" },
    ],
  };
  assert.deepEqual(findSyntheticRosterMatches("陈默阳是几班", ambiguousRoster), []);
  assert.match(getSyntheticRosterFallback("陈默阳是几班", ambiguousRoster), /不猜/);
});

test("does not place teachers into student classes or invent unknown roster entries", () => {
  assert.match(getSyntheticRosterFallback("高鹏院长是几班", roster), /老师不在这届学生里/);
  assert.match(getSyntheticRosterFallback("你知道不存在的人吗", roster), /不猜/);
});
