import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotFile = path.join(root, "docs/architecture/modularization-contract-snapshot.json");
const reportFile = path.join(root, "docs/architecture/MODULARIZATION_CHARACTERIZATION_REPORT.md");
const coverageFile = path.join(root, "docs/architecture/modularization-coverage.json");
const resultsFile = path.join(root, "docs/architecture/modularization-validation.json");
const source = spawnSync(process.execPath, [path.join(root, "scripts/measure-modularization.mjs"), "--json"], { cwd: root, encoding: "utf8" });
if (source.status !== 0) throw new Error(source.stderr || `measure-modularization exited ${source.status}`);
const measured = JSON.parse(source.stdout);

function normalize(text) { return String(text).replace(/\s+/g, " ").trim(); }
function routeEntries() {
  return [...measured.inspections, ...measured.handlerInspections]
    .flatMap((inspection) => inspection.routeConditions.map(({ condition, scope }) => ({ file: inspection.file, scope, predicate: normalize(condition) })))
    .sort((a, b) => a.file.localeCompare(b.file) || a.scope.localeCompare(b.scope) || a.predicate.localeCompare(b.predicate));
}
function pathEntries() {
  return [...measured.inspections, ...measured.handlerInspections]
    .flatMap((inspection) => inspection.routeCandidates.map(({ value, scope }) => ({ file: inspection.file, scope, path: value })))
    .sort((a, b) => a.file.localeCompare(b.file) || a.path.localeCompare(b.path) || a.scope.localeCompare(b.scope));
}
function currentSnapshot() {
  return { schema: 1, routePredicates: routeEntries(), apiPathLiterals: pathEntries() };
}
function tally(records) {
  const counts = new Map();
  for (const record of records) {
    const key = JSON.stringify(record);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}
function differences(before, after) {
  const left = tally(before), right = tally(after), added = [], removed = [];
  for (const [key, count] of right) for (let i = left.get(key) || 0; i < count; i++) added.push(JSON.parse(key));
  for (const [key, count] of left) for (let i = right.get(key) || 0; i < count; i++) removed.push(JSON.parse(key));
  return { added, removed };
}
function readJson(file) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null; }

const mode = process.argv[2] || "--report";
if (mode === "--snapshot") {
  process.stdout.write(`${JSON.stringify(currentSnapshot(), null, 2)}\n`);
} else if (mode === "--write-snapshot") {
  if (fs.existsSync(snapshotFile)) throw new Error("Baseline snapshot already exists; review contract drift instead of overwriting it.");
  fs.writeFileSync(snapshotFile, `${JSON.stringify(currentSnapshot(), null, 2)}\n`);
} else if (mode === "--report" || mode === "--write-report") {
  const baseline = readJson(snapshotFile);
  const coverage = readJson(coverageFile);
  const validation = readJson(resultsFile);
  if (!baseline || !coverage || !validation) throw new Error("Snapshot, coverage and validation manifests are required.");
  for (const domain of coverage.domains) {
    if (!domain.domain || !domain.gap || !Array.isArray(domain.tests)) throw new Error("Invalid coverage domain entry.");
    for (const file of domain.tests) if (!fs.existsSync(path.join(root, file))) throw new Error(`Coverage evidence missing: ${file}`);
  }
  for (const run of validation.runs) {
    if (!["passed", "failed", "skipped"].includes(run.outcome)) throw new Error(`Invalid validation outcome: ${run.command}`);
  }
  const current = currentSnapshot();
  const predicateDiff = differences(baseline.routePredicates, current.routePredicates);
  const pathDiff = differences(baseline.apiPathLiterals, current.apiPathLiterals);
  const primary = measured.primary.map(({ file, lines, bytes }) => ({ file, lines, bytes }));
  const endpointCatalog = fs.readFileSync(path.join(root, "docs/architecture/endpoints.md"), "utf8");
  const verifiedEndpointRows = endpointCatalog.split(/\r?\n/).filter((line) => /^\| `(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/.test(line)).length;
  const adminModules = measured.files.filter(({ file }) => /^backend\/public\/admin-modules\/[^/]+\.js$/.test(file));
  const backendHandlers = measured.handlerInspections.map(({ file }) => measured.files.find((item) => item.file === file));
  const attention = measured.files.filter(({ file, lines }) => lines > 600
    && (/^(backend\/|src\/)/.test(file) || file === "scripts/smoke-tests.js")
    && !["backend/server.js", "backend/public/admin.js", "backend/public/jsQR.js"].includes(file));
  const candidateDomains = coverage.domains.filter((item) => item.tests.length > 0).length;
  const resultCounts = validation.runs.reduce((totals, run) => {
    totals[run.outcome] = (totals[run.outcome] || 0) + 1;
    totals.testsPassed += run.testsPassed || 0;
    totals.testsFailed += run.testsFailed || 0;
    totals.testsSkipped += run.testsSkipped || 0;
    return totals;
  }, { passed: 0, failed: 0, skipped: 0, testsPassed: 0, testsFailed: 0, testsSkipped: 0 });
  const lines = [
    "# Relatório reproduzível de caracterização", "",
    `- ` + primary.map((item) => `\`${item.file}\`: ${item.lines} linhas (${item.bytes} bytes)`).join("; ") + ".",
    `- Critérios estáticos de rota: ${current.routePredicates.length}; literais \`/api/\`: ${current.apiPathLiterals.length} ocorrências, ${new Set(current.apiPathLiterals.map((item) => item.path)).size} valores distintos. São candidatos, não endpoints verificados.`,
    `- Entradas método/caminho verificadas manualmente em \`endpoints.md\`: ${verifiedEndpointRows}; o catálogo declara cobertura parcial.`,
    `- Módulos de rotas já extraídos: ${backendHandlers.length}; módulos Admin: ${adminModules.length}.`,
    `- Outros arquivos próprios acima do limite de atenção de 600 linhas: ${attention.length} (excluídos os dois alvos principais e a biblioteca vendorizada jsQR).`,
    `- Domínios com testes identificados: ${candidateDomains}/${coverage.domains.length}; a presença de teste não prova cobertura completa.`,
    `- Comandos: ${resultCounts.passed} aprovados, ${resultCounts.failed} falhos, ${resultCounts.skipped} não executados; contagens TAP somadas por execução (podem repetir testes entre comandos): ${resultCounts.testsPassed} aprovados, ${resultCounts.testsFailed} falhos, ${resultCounts.testsSkipped} ignorados.`,
    `- Diferença estática ante o snapshot: predicados +${predicateDiff.added.length}/-${predicateDiff.removed.length}; caminhos +${pathDiff.added.length}/-${pathDiff.removed.length}. Mudança de dono também aparece como diferença e exige revisão manual de contrato.`, "",
    "## Arquivos acima do limite de atenção", "",
    ...attention.map((item) => `- \`${item.file}\`: ${item.lines} linhas`), "",
    "## Execuções registradas", "",
    ...validation.runs.map((run) => `- \`${run.command}\`: ${run.outcome}${run.note ? ` — ${run.note}` : ""}`), "",
    "## Pré-requisitos e CI", "",
    ...validation.setupAttempts.map((attempt) => `- ${attempt.operation}: ${attempt.result}`),
    `- CI do commit anterior \`${validation.ciAtPreviousCommit.sha}\`: Security regression ${validation.ciAtPreviousCommit.securityConclusion} (run ${validation.ciAtPreviousCommit.securityRunId}). ${validation.ciAtPreviousCommit.note}`, "",
    "## Mudanças estáticas", "",
    ...[...predicateDiff.added.map((item) => `- Predicado adicionado: ${item.file} ${item.scope} ${item.predicate}`),
      ...predicateDiff.removed.map((item) => `- Predicado removido: ${item.file} ${item.scope} ${item.predicate}`),
      ...pathDiff.added.map((item) => `- Caminho adicionado: ${item.file} ${item.path}`),
      ...pathDiff.removed.map((item) => `- Caminho removido: ${item.file} ${item.path}`)].slice(0, 50)
  ];
  if (!predicateDiff.added.length && !predicateDiff.removed.length && !pathDiff.added.length && !pathDiff.removed.length) lines.push("Nenhuma diferença estática.");
  const report = `${lines.join("\n")}\n`;
  if (mode === "--write-report") fs.writeFileSync(reportFile, report);
  else process.stdout.write(report);
} else {
  throw new Error(`Unknown option: ${mode}`);
}
