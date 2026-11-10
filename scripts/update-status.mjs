#!/usr/bin/env node
/**
 * 按给定日期更新报名状态。
 * 截止日当天仍算报名中（日期比较为“今天 > 截止日”才关闭）。
 * 若 late_registration.enabled 且 window 里最晚的 YYYY-MM-DD 仍 ≥ 今天，标为 late_open，不进档案。
 * 没有截止日的记录保持原状态（例如已售罄后的慈善号码布、尚未公布日期的赛事）。
 *
 * 用法：
 *   node scripts/update-status.mjs --date 2026-11-10
 *   node scripts/update-status.mjs --date 2026-11-11 --dry-run
 * 缺省日期为 UTC 当天。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return null;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === fileURLToPath(import.meta.url);
}

function readJson(name) {
  return JSON.parse(readFileSync(join(root, "data", name), "utf8"));
}

function lateEnd(late) {
  if (!late || late.enabled !== true || !late.window) return null;
  if (typeof late.window === "string") {
    const dates = late.window.match(/\d{4}-\d{2}-\d{2}/g);
    return dates ? dates[dates.length - 1] : null;
  }
  if (typeof late.window === "object" && typeof late.window.end === "string") {
    return late.window.end;
  }
  return null;
}

export function nextStatus(race, asOf) {
  const close = race.registration_close;
  const open = race.registration_open;
  const end = lateEnd(race.late_registration);
  if (close && asOf > close) {
    if (end && asOf <= end) return "late_open";
    return "closed";
  }
  if (race.late_registration?.enabled && !close) return "late_open";
  if (open && asOf < open) return "upcoming_unknown";
  if (close && asOf <= close) return "open";
  if (open && asOf >= open && race.status !== "late_open") return "open";
  return race.status;
}

function apply(race, asOf) {
  const status = nextStatus(race, asOf);
  if (status === race.status) return race;
  return { ...race, status };
}

function main() {
const today = argValue("--date") || new Date().toISOString().slice(0, 10);
const dryRun = process.argv.includes("--dry-run");
if (!ISO.test(today)) {
  console.error("--date 须为 YYYY-MM-DD");
  process.exit(1);
}

const races = readJson("races.json");
const archive = readJson("archive.json");
if (!Array.isArray(races) || !Array.isArray(archive)) {
  console.error("races.json 与 archive.json 都必须是数组");
  process.exit(1);
}

const stay = [];
const moved = [];
for (const race of races) {
  const updated = apply(race, today);
  if (updated.status === "closed") moved.push(updated);
  else stay.push(updated);
}

const archiveIds = new Set(archive.map((r) => r.id));
const nextArchive = archive.slice();
for (const race of moved) {
  if (archiveIds.has(race.id)) {
    const idx = nextArchive.findIndex((r) => r.id === race.id);
    nextArchive[idx] = race;
  } else {
    nextArchive.push(race);
  }
}

const before = JSON.stringify({ races, archive });
const after = JSON.stringify({ races: stay, archive: nextArchive });
const changed = before !== after;

console.log(
  `核对日 ${today}：保留 ${stay.length} 场，新移入档案 ${moved.length} 场，档案合计 ${nextArchive.length} 场。`
);
if (moved.length) {
  moved.forEach((r) => console.log(`  归档 ${r.id}  ${r.name_zh}`));
}
if (dryRun) {
  console.log(changed ? "演练：有变更，未写文件。" : "演练：无变更。");
  process.exit(0);
}
if (!changed) {
  console.log("无变更。");
  process.exit(0);
}
writeFileSync(join(root, "data", "races.json"), JSON.stringify(stay, null, 2) + "\n");
writeFileSync(join(root, "data", "archive.json"), JSON.stringify(nextArchive, null, 2) + "\n");
console.log("已写回 data/races.json 与 data/archive.json。");
}

if (isDirectRun()) main();
