import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = "backend/server.js";
const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
if (source.parseDiagnostics.length) throw new Error("backend/server.js não pode ser analisado.");
const api = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "handleApi");
if (!api?.body) throw new Error("handleApi não encontrado.");

const matchers = new Map();
const rows = [];
const oneLine = (value) => value.replace(/\s+/g, " ").trim();
const cell = (value) => String(value).replaceAll("|", "\\|").replaceAll("`", "'");
for (const [index, statement] of api.body.statements.entries()) {
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        matchers.set(declaration.name.text, oneLine(declaration.initializer.getText(source)));
      }
    }
  }
  if (!ts.isIfStatement(statement)) continue;
  const predicate = oneLine(statement.expression.getText(source));
  const usedMatchers = [...matchers].filter(([name, expression]) =>
    new RegExp(`\\b${name}\\b`).test(predicate) && /pathname\.match\(/.test(expression));
  rows.push({ order: index + 1, predicate, matchers: usedMatchers.map(([name, expression]) => `${name}: ${expression}`) });
}

if (process.argv[2] === "--json") {
  process.stdout.write(`${JSON.stringify({ source: file, topLevelStatements: api.body.statements.length, topLevelIfBranches: rows.length, branches: rows }, null, 2)}\n`);
} else if (!process.argv[2] || process.argv[2] === "--markdown") {
  process.stdout.write(`<!-- Gerado por node scripts/fase21-route-snapshot.mjs --markdown; predicados do HEAD, não substitui revisão dos handlers delegados. -->\n`);
  process.stdout.write(`| Ordem no corpo de handleApi | Condição avaliada | Matcher definido antes da condição |\n| ---: | --- | --- |\n`);
  for (const row of rows) process.stdout.write(`| ${row.order} | \`${cell(row.predicate)}\` | ${row.matchers.length ? `\`${cell(row.matchers.join("; "))}\`` : "—"} |\n`);
} else {
  throw new Error("Use --json ou --markdown.");
}
