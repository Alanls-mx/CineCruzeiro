#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const directory = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(directory)) process.exit(0);

const dailyCount = Math.max(1, Number(process.env.BACKUP_KEEP_DAILY || 14));
const weeklyCount = Math.max(1, Number(process.env.BACKUP_KEEP_WEEKLY || 8));
const monthlyCount = Math.max(1, Number(process.env.BACKUP_KEEP_MONTHLY || 12));
const recentHours = Math.max(6, Number(process.env.BACKUP_KEEP_RECENT_HOURS || 48));
const pattern = /^cinecruzeiro-(\d{8}T\d{6}Z)\.tar\.gz\.gpg$/;

function parseStamp(value) {
  const match = value.match(pattern);
  if (!match) return null;
  const stamp = match[1];
  const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoWeek(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const backups = fs.readdirSync(directory)
  .map((name) => ({ name, date: parseStamp(name) }))
  .filter((item) => item.date)
  .sort((a, b) => b.date - a.date);
const keep = new Set();
const buckets = [
  { limit: dailyCount, key: (date) => date.toISOString().slice(0, 10) },
  { limit: weeklyCount, key: isoWeek },
  { limit: monthlyCount, key: (date) => date.toISOString().slice(0, 7) }
];
const recentCutoff = Date.now() - recentHours * 60 * 60 * 1000;
for (const backup of backups) {
  if (backup.date.getTime() >= recentCutoff) keep.add(backup.name);
}
for (const bucket of buckets) {
  const selected = new Set();
  for (const backup of backups) {
    const key = bucket.key(backup.date);
    if (selected.has(key) || selected.size >= bucket.limit) continue;
    selected.add(key);
    keep.add(backup.name);
  }
}
for (const backup of backups) {
  if (keep.has(backup.name)) continue;
  fs.rmSync(path.join(directory, backup.name), { force: true });
  fs.rmSync(path.join(directory, `${backup.name}.sha256`), { force: true });
}

console.log(`BACKUP_RETENTION_OK kept=${keep.size} removed=${backups.length - keep.size}`);
