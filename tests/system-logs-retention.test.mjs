import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import scheduleModule from "../backend/services/backendRuntimeSchedule.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postgresStorePath = path.join(root, "backend", "db", "postgresStore.js");
const serverPath = path.join(root, "backend", "server.js");
const maintenancePath = path.join(root, "backend", "services", "backendMaintenanceTasks.js");
const adminLogsPath = path.join(root, "backend", "services", "adminLogsHandler.js");

test("postgresStore define politica de retencao para diagnostico tecnico (3 dias) e geral (90 dias)", () => {
  const code = fs.readFileSync(postgresStorePath, "utf8");
  assert.match(code, /technicalDays = Math\.min\(3650, Math\.max\(1, Number\(isObject \? options\.technicalRetentionDays : 3\) \|\| 3\)\)/);
  assert.match(code, /DELETE FROM system_logs/);
  assert.match(code, /level != 'error'/);
  assert.match(code, /NOT \(event = ANY\(\$2::text\[\]\)\)/);
});

test("manutencao periodica e rota DELETE preservam retencao de 3 dias", () => {
  const code = fs.readFileSync(serverPath, "utf8");
  const maintenance = fs.readFileSync(maintenancePath, "utf8");
  assert.match(maintenance, /async function runSystemLogMaintenance\(\)/);
  assert.match(maintenance, /technicalRetentionDays = Math\.min\(3650, Math\.max\(1, Number\(process\.env\.TECHNICAL_LOG_RETENTION_DAYS \|\| 3\)\)\)/);
  assert.match(code, /runSystemLogMaintenance, postgresEnabled/);
  assert.match(code, /backendRuntimeSchedule\.start\(\)/);
  assert.match(fs.readFileSync(adminLogsPath, "utf8"), /technicalRetentionDays = Math\.min\(3650, Math\.max\(1, Number\(body\.technicalRetentionDays \|\| 3\)\)\)/);
});

test("retencao de logs inicia apenas em PostgreSQL e repete a cada seis horas", () => {
  const timers = [];
  const calls = [];
  const schedule = scheduleModule.createBackendRuntimeSchedule({
    runSubscriptionMaintenance: () => {}, runMovieImageMaintenance: () => {},
    runEmailAttachmentMaintenance: () => {}, runSystemLogMaintenance: () => calls.push("logs"),
    resumeSocialStudio: () => {}, startPostgresWorkers: () => {}, stopPostgresWorkers: () => {},
    postgresEnabled: () => true, pruneCrmOutbox: () => {}, sendDiscordHealth: () => {},
    subscriptionIntervalMs: 60000,
    setIntervalFn: (callback, delay) => { timers.push({ callback, delay }); return { unref() {} }; },
    clearIntervalFn: () => {}
  });
  schedule.start();
  assert.deepEqual(calls, ["logs"]);
  const sixHourTimers = timers.filter((timer) => timer.delay === 6 * 60 * 60 * 1000);
  assert.ok(sixHourTimers.length > 0, "a retencao deve ser agendada em seis horas");
  sixHourTimers.forEach((timer) => timer.callback());
  assert.deepEqual(calls, ["logs", "logs"]);
  schedule.stop();
});
