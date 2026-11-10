#!/usr/bin/env node
/**
 * 校验 data/races.json、data/archive.json、data/elites.json。
 * 用法：node scripts/validate.mjs [--date YYYY-MM-DD]
 * --date 用来核对“报名截止日已过则不应仍留在 races.json”。默认 2026-11-10 不写死，
 * 缺省取 UTC 当天，便于每日任务。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function load(name) {
  const path = join(root, "data", name);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(`${name} 无法解析：${err.message}`);
    return null;
  }
}

function argDate() {
  const i = process.argv.indexOf("--date");
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return new Date().toISOString().slice(0, 10);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(["open", "late_open", "closed", "upcoming_unknown"]);
const RACE_KEYS = [
  "id",
  "name_zh",
  "name_en",
  "country",
  "region",
  "date_start",
  "date_end",
  "official_url",
  "registration_url",
  "registration_open",
  "registration_close",
  "late_registration",
  "status",
  "transport",
  "scale_total",
  "categories",
  "entry_requirements",
  "mandatory_gear",
  "sponsors",
  "organizer",
  "sources",
  "last_checked",
];

function isNullish(v) {
  return v === null || v === undefined;
}

function checkDate(value, label, { allowNull = true } = {}) {
  if (value === null && allowNull) return;
  if (typeof value !== "string" || !ISO.test(value)) {
    fail(`${label} 须为 YYYY-MM-DD 或 null，实际为 ${JSON.stringify(value)}`);
  }
}

function checkUrl(value, label, { allowNull = false } = {}) {
  if (value === null && allowNull) return;
  if (typeof value !== "string" || !/^https?:\/\//.test(value)) {
    fail(`${label} 须为 http(s) URL`);
  }
}

function lateEnd(late) {
  if (!late || late.enabled !== true) return null;
  const window = late.window;
  if (!window) return null;
  if (typeof window === "string") {
    const dates = window.match(/\d{4}-\d{2}-\d{2}/g);
    return dates ? dates[dates.length - 1] : null;
  }
  if (typeof window === "object" && typeof window.end === "string") return window.end;
  return null;
}

function checkRace(race, file, index, asOf) {
  const where = `${file}[${index}]`;
  if (!race || typeof race !== "object" || Array.isArray(race)) {
    fail(`${where} 不是对象`);
    return;
  }
  for (const key of RACE_KEYS) {
    if (!(key in race)) fail(`${where} 缺少字段 ${key}`);
  }
  if (typeof race.id !== "string" || !race.id) fail(`${where} id 无效`);
  if (typeof race.name_zh !== "string" || !race.name_zh) fail(`${where} name_zh 无效`);
  if (race.name_en !== null && typeof race.name_en !== "string") fail(`${where} name_en 类型错误`);
  if (typeof race.country !== "string" || !race.country) fail(`${where} country 无效`);
  if (race.region !== null && typeof race.region !== "string") fail(`${where} region 类型错误`);
  for (const key of ["date_start", "date_end", "registration_open", "registration_close"]) {
    checkDate(race[key], `${where}.${key}`);
  }
  checkDate(race.last_checked, `${where}.last_checked`, { allowNull: false });
  checkUrl(race.official_url, `${where}.official_url`);
  checkUrl(race.registration_url, `${where}.registration_url`, { allowNull: true });
  if (!STATUSES.has(race.status)) fail(`${where} status 非法：${race.status}`);
  const late = race.late_registration;
  if (!late || typeof late !== "object" || typeof late.enabled !== "boolean") {
    fail(`${where} late_registration.enabled 须为布尔值`);
  }
  if (!Array.isArray(race.categories)) fail(`${where} categories 须为数组`);
  else {
    race.categories.forEach((c, i) => {
      const loc = `${where}.categories[${i}]`;
      if (!c || typeof c.name !== "string" || !c.name) fail(`${loc}.name 无效`);
      for (const numKey of ["distance_km", "elevation_gain_m", "cutoff_hours"]) {
        if (c[numKey] !== null && typeof c[numKey] !== "number") {
          fail(`${loc}.${numKey} 须为数字或 null`);
        }
      }
      if ("fee" in c && c.fee !== null) {
        if (typeof c.fee !== "object" || typeof c.fee.currency !== "string") {
          fail(`${loc}.fee 须为 {amount, currency} 或 null`);
        } else if (typeof c.fee.amount !== "number") {
          fail(`${loc}.fee.amount 须为数字`);
        }
      }
    });
  }
  if (!Array.isArray(race.sources) || race.sources.length === 0) {
    fail(`${where} sources 须为非空 URL 数组`);
  } else {
    race.sources.forEach((url, i) => checkUrl(url, `${where}.sources[${i}]`));
  }
  if (race.scale_total !== null && typeof race.scale_total !== "number") {
    fail(`${where} scale_total 须为数字或 null`);
  }
  if (file === "races.json" && race.status === "closed") {
    fail(`${where} 报名已关闭的记录应放在 archive.json`);
  }
  if (file === "archive.json" && race.status !== "closed") {
    fail(`${where} 档案里的 status 应为 closed`);
  }
  const close = race.registration_close;
  const end = lateEnd(race.late_registration);
  if (file === "races.json" && close && asOf > close) {
    if (!(end && asOf <= end)) {
      fail(`${where} 报名截止 ${close} 早于 ${asOf}，且补录窗口已过或未设，应移入档案`);
    } else if (race.status !== "late_open") {
      fail(`${where} 处于补录窗口，status 应为 late_open`);
    }
  }
}

const asOf = argDate();
if (!ISO.test(asOf)) {
  console.error("--date 须为 YYYY-MM-DD");
  process.exit(1);
}

const races = load("races.json");
const archive = load("archive.json");
const elites = load("elites.json");

if (races && !Array.isArray(races)) fail("races.json 须为数组");
if (archive && !Array.isArray(archive)) fail("archive.json 须为数组");
if (elites && !Array.isArray(elites)) fail("elites.json 须为数组");

const ids = new Map();
function takeId(race, file) {
  if (!race || typeof race.id !== "string") return;
  if (ids.has(race.id)) fail(`重复 id ${race.id}（${ids.get(race.id)} 与 ${file}）`);
  else ids.set(race.id, file);
}

if (Array.isArray(races)) {
  races.forEach((race, i) => {
    checkRace(race, "races.json", i, asOf);
    takeId(race, "races.json");
  });
}
if (Array.isArray(archive)) {
  archive.forEach((race, i) => {
    checkRace(race, "archive.json", i, asOf);
    takeId(race, "archive.json");
  });
}
if (Array.isArray(elites)) {
  elites.forEach((row, i) => {
    const where = `elites.json[${i}]`;
    if (!row || typeof row !== "object") {
      fail(`${where} 不是对象`);
      return;
    }
    if (typeof row.race_id !== "string" || !ids.has(row.race_id)) {
      fail(`${where} race_id 不在 races.json 或 archive.json 中`);
    }
    if (typeof row.category !== "string") fail(`${where} category 无效`);
    checkUrl(row.source_url, `${where}.source_url`);
    checkDate(row.last_checked, `${where}.last_checked`, { allowNull: false });
    if (!Array.isArray(row.athletes)) fail(`${where} athletes 须为数组`);
    else {
      row.athletes.forEach((a, j) => {
        if (!a || typeof a.name !== "string" || !a.name) fail(`${where}.athletes[${j}].name 无效`);
        if (a.nationality !== null && typeof a.nationality !== "string") {
          fail(`${where}.athletes[${j}].nationality 类型错误`);
        }
      });
      if (row.athletes.length === 0) warn(`${where} 运动员列表为空`);
    }
  });
}

const openCount = Array.isArray(races)
  ? races.filter((r) => r.status === "open" || r.status === "late_open").length
  : 0;

if (warnings.length) {
  console.log(`提示 ${warnings.length} 条：`);
  warnings.forEach((w) => console.log("  - " + w));
}
if (errors.length) {
  console.error(`校验失败 ${errors.length} 条（核对日 ${asOf}）：`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log(
  `校验通过（核对日 ${asOf}）。在榜可报名 ${openCount} 场，档案 ${archive?.length ?? 0} 场，精英名单 ${elites?.length ?? 0} 条。`
);
