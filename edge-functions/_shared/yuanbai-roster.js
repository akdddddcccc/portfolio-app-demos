export const YUANBAI_ROSTER_KEY = "synthetic-roster-v1";

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

export function findSyntheticRosterMatches(query, roster) {
  const value = parseSyntheticRoster(roster);
  if (!value) return [];
  const normalizedQuery = String(query || "").replace(/\s+/g, "").toLowerCase();
  if (!normalizedQuery) return [];
  const asksGender = /性别|男生|女生|男女/.test(query);
  return value.records
    .filter(({ name }) => normalizedQuery.includes(name.toLowerCase()))
    .map((record) => ({
      name: record.name,
      class: record.class,
      ...(asksGender ? { gender: record.gender } : {}),
    }));
}
