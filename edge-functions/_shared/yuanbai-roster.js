import { pinyin } from "pinyin-pro";

const ALLOWED_RECORD_KEYS = new Set(["name", "gender", "class"]);

export function parseSyntheticRoster(content) {
  let value;
  try {
    value = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    return null;
  }
  if (!value || Object.keys(value).length !== 2 || value.synthetic !== true || !Array.isArray(value.records) || value.records.length < 1 || value.records.length > 200) {
    return null;
  }

  const records = value.records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    const keys = Object.keys(record);
    if (keys.length !== 3 || !keys.every((key) => ALLOWED_RECORD_KEYS.has(key))) return null;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const gender = typeof record.gender === "string" ? record.gender.trim() : "";
    const className = typeof record.class === "string" ? record.class.trim() : "";
    if (!/^[\p{L}·]{2,12}$/u.test(name)) return null;
    if (!["男", "女"].includes(gender)) return null;
    if (!/^(?:20)?26级[123]班$/.test(className)) return null;
    return { name, gender, class: className };
  });
  if (records.some((record) => !record)) return null;
  return { synthetic: true, records };
}

export function findSyntheticRosterMatches(query, roster, options = {}) {
  const value = parseSyntheticRoster(roster);
  if (!value) return [];
  if (/(老师|院长|教授|导师|教师|教职工|工作人员)/.test(String(query || ""))) return [];
  const normalizedQuery = normalizeNameQuery(query);
  if (!normalizedQuery) return [];
  const asksGender = options.includeGender === true || /性别|男生|女生|男女/.test(query);
  const exactMatches = value.records.filter(({ name }) => normalizedQuery.includes(name.toLowerCase()));
  if (exactMatches.length) return exactMatches.map((record) => formatMatch(record, asksGender));

  const queryNames = extractNameCandidates(normalizedQuery);
  if (!queryNames.length) return [];
  const ranked = value.records.map((record) => ({
    record,
    score: Math.max(...queryNames
      .filter((candidate) => candidate.length === record.name.length)
      .map((candidate) => phoneticSimilarity(candidate, record.name)), 0),
  })).filter(({ score }) => score >= 0.82)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return [];

  // Never choose between similarly plausible roster entries.
  const bestScore = ranked[0].score;
  const bestMatches = ranked.filter(({ score }) => bestScore - score < 0.035);
  if (bestMatches.length !== 1) return [];
  return [formatMatch(bestMatches[0].record, asksGender)];
}

function formatMatch(record, asksGender) {
  return {
      name: record.name,
      class: record.class,
      ...(asksGender ? { gender: record.gender } : {}),
  };
}

export function getSyntheticRosterAnswer(query, roster) {
  const text = String(query || "").trim();
  if (!text || /(老师|院长|教授|导师|教师|教职工|工作人员)/.test(text)) return null;
  const asksRosterQuestion = /(你知道|你认识|你认得|认识|认得|是谁|哪位|几班|哪个班|哪一班|什么班|班级)/.test(text);
  if (!asksRosterQuestion) return null;

  const matches = findSyntheticRosterMatches(text, roster);
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (/性别|男生|女生|男女/.test(text)) return `名单登记的性别是${match.gender || "未记录"}。`;

  const wishes = [
    "愿以后能做出自己珍视的作品，也有机会去争取红点或 iF 这样的奖项。",
    "未来无论走向体验设计、服务设计，还是产品管理，都祝你找到施展本领的位置。",
    "祝你把设计这条路走得宽些：作品有回响，工作有成长，生活也留有余裕。",
    "愿你有一天把好想法做成真正帮到人的产品；去大厂闯一闯，或者选择喜欢的团队，都很好。",
    "红点和 iF 都可以去争取；更愿你做的事情有意思，日子过得踏实自在。",
  ];
  const wish = wishes[Math.floor(Math.random() * wishes.length)];
  return `${match.name}在${match.class}。${wish}`;
}

function normalizeNameQuery(query) {
  return String(query || "").replace(/\s+/g, "").toLowerCase()
    .replace(/^(?:请问|我想问|你知道|你认识|你认得|认识|认得|知道|帮我查一下|查一下)+/u, "")
    .replace(/(?:这位同学|这个同学|同学|学生|吗|么|呢|呀|啊|是谁|是哪位|的班级|几班|哪个班|哪一班|什么班|班级|性别|男生|女生|男女)+$/u, "")
    .replace(/[^\p{Script=Han}]/gu, "");
}

function extractNameCandidates(value) {
  const candidates = new Set();
  for (let length = 2; length <= Math.min(4, value.length); length += 1) {
    for (let start = 0; start + length <= value.length; start += 1) {
      candidates.add(value.slice(start, start + length));
    }
  }
  return [...candidates];
}

function phoneticSimilarity(left, right) {
  const leftSyllables = pinyin(left, { toneType: "none", type: "array" });
  const rightSyllables = pinyin(right, { toneType: "none", type: "array" });
  if (leftSyllables.length !== rightSyllables.length || leftSyllables.length < 2) return 0;
  const similarities = leftSyllables.map((syllable, index) => {
    const other = rightSyllables[index];
    const longest = Math.max(syllable.length, other.length, 1);
    return 1 - editDistance(syllable, other) / longest;
  });
  return similarities.reduce((sum, score) => sum + score, 0) / similarities.length;
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const diagonal = previous;
      previous = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
  }
  return row[right.length];
}

export function getSyntheticRosterFallback(query, roster) {
  const text = String(query || "").trim();
  if (!text) return "我没听清你问的是谁，先不乱猜班级。";

  const asksClass = /(几班|哪个班|哪一班|什么班|班级)/.test(text);
  const asksStaff = /(老师|院长|教授|导师|教师|教职工|工作人员)/.test(text);
  if (asksStaff) {
    return asksClass ? "老师不在这届学生里，我就不把老师分到这三个班了。" : null;
  }

  const asksPerson = /(你知道|你认识|你认得|认识|认得|是谁|哪位)/.test(text);
  if (!asksClass && !asksPerson) return null;
  if (!asksClass && !/(同学|学生)/.test(text) && /(学院猫|小灯|如意|小海绵|元白楼)/.test(text)) return null;

  const value = parseSyntheticRoster(roster);
  if (!value) return "这个名字我没对上，怕说错班级，先不猜了。";
  const matches = findSyntheticRosterMatches(text, value);
  if (matches.length) return null;
  return "这个名字我没对上，怕说错班级，先不猜了。";
}
