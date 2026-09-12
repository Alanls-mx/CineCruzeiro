import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postgresStorePath = path.join(root, "backend", "db", "postgresStore.js");
const serverPath = path.join(root, "backend", "server.js");

test("postgresStore define politica de retencao para diagnostico tecnico (3 dias) e geral (90 dias)", () => {
  const code = fs.readFileSync(postgresStorePath, "utf8");
  assert.match(code, /technicalDays = Math\.min\(3650, Math\.max\(1, Number\(isObject \? options\.technicalRetentionDays : 3\) \|\| 3\)\)/);
  assert.match(code, /DELETE FROM system_logs/);
  assert.match(code, /level != 'error'/);
  assert.match(code, /NOT \(event = ANY\(\$2::text\[\]\)\)/);
});

test("server.js executa manutencao periodica de logs e rota DELETE com retencao de 3 dias", () => {
  const code = fs.readFileSync(serverPath, "utf8");
  assert.match(code, /async function runSystemLogMaintenance\(\)/);
  assert.match(code, /technicalRetentionDays = Math\.min\(3650, Math\.max\(1, Number\(process\.env\.TECHNICAL_LOG_RETENTION_DAYS \|\| 3\)\)\)/);
  assert.match(code, /systemLogMaintenanceTimer = setInterval/);
  assert.match(code, /6 \* 60 \* 60 \* 1000/);
  assert.match(code, /technicalRetentionDays: Math\.min\(3650, Math\.max\(1, Number\(body\.technicalRetentionDays \|\| 3\)\)\)/);
});
