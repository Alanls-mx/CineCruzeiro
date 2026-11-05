import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const primary = ["backend/server.js", "backend/public/admin.js"];
const related = ["backend/public/admin.html", "backend/start.js", "src/components/CheckoutPage.tsx", "src/services/cinemaApi.ts"];
const routeOwners = ["backend/services/movieCatalogHandler.js", "backend/services/venueConfigurationHandler.js", "backend/services/commercialCatalogHandler.js", "backend/services/adminLogsHandler.js"];
const sourceRoots = ["backend", "src", "tests", "scripts", "e2e"];
const extensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".html", ".css", ".sql"]);

function lines(value) {
  if (!value) return 0;
  return value.split(/\r\n|\n|\r/).length - (/(?:\r\n|\n|\r)$/.test(value) ? 1 : 0);
}

function size(file) {
  const contents = fs.readFileSync(path.join(root, file), "utf8");
  return { file, lines: lines(contents), bytes: Buffer.byteLength(contents) };
}

function walk(directory) {
  const full = path.join(root, directory);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(directory.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) return walk(relative);
    return entry.isFile() && extensions.has(path.extname(entry.name)) ? [relative] : [];
  });
}

function place(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function functionName(node, source) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isPropertyAssignment(parent)) return parent.name.getText(source);
  if (ts.isBinaryExpression(parent)) return parent.left.getText(source);
  return `callback@${place(source, node)}`;
}

function enclosingTopLevel(node, source) {
  let cursor = node.parent;
  while (cursor && cursor !== source) {
    if (ts.isFunctionDeclaration(cursor) && cursor.parent === source) return cursor.name?.text || "anonymous";
    cursor = cursor.parent;
  }
  return "module";
}

function inspect(file) {
  const contents = fs.readFileSync(path.join(root, file), "utf8");
  const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (source.parseDiagnostics.length) throw new Error(`${file}: parse error at ${source.parseDiagnostics[0].start}`);
  const symbols = [];
  const listeners = [];
  const routeCandidates = [];
  const routeConditions = [];
  const imports = new Set();
  let stateKeys = 0;
  function visit(node) {
    const isFunction = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
    if (isFunction || ts.isClassDeclaration(node)) {
      symbols.push({ file, kind: ts.SyntaxKind[node.kind], name: functionName(node, source), line: place(source, node), endLine: source.getLineAndCharacterOfPosition(node.end).line + 1, scope: enclosingTopLevel(node, source) });
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "state" && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      stateKeys = node.initializer.properties.length;
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if (callee === "require" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.add(node.arguments[0].text);
      if (/(?:^|\.)(addEventListener|on|once|listen|setInterval|setTimeout|clearInterval|clearTimeout|requestAnimationFrame)$/.test(callee)) {
        listeners.push({ file, line: place(source, node), kind: callee.split(".").at(-1), target: callee, event: node.arguments[0]?.getText(source).slice(0, 100) || "" });
      }
    }
    if (ts.isNewExpression(node) && ["EventSource", "WebSocket", "MutationObserver", "ResizeObserver"].includes(node.expression.getText(source))) {
      listeners.push({ file, line: place(source, node), kind: "new", target: node.expression.getText(source), event: "" });
    }
    if (ts.isStringLiteral(node) && node.text.startsWith("/api/")) {
      routeCandidates.push({ file, line: place(source, node), value: node.text, scope: enclosingTopLevel(node, source) });
    }
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(source);
      if (condition.includes("/api/") || /\bpathname\b/.test(condition)) {
        routeConditions.push({ file, line: place(source, node), condition: condition.replaceAll(/\s+/g, " ").slice(0, 350), scope: enclosingTopLevel(node, source) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { file, symbols, listeners, routeCandidates, routeConditions, imports: [...imports].sort(), stateKeys };
}

const primaryStats = primary.map(size);
const relatedStats = related.map(size);
const allFiles = [...new Set([...primary, ...related, ...sourceRoots.flatMap(walk)])].map(size).sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));
const inspections = primary.map(inspect);
const handlerInspections = routeOwners.map(inspect);
const selected = process.argv[2] || "--summary";
if (selected === "--json") {
  console.log(JSON.stringify({ primary: primaryStats, related: relatedStats, files: allFiles, inspections, handlerInspections }, null, 2));
} else if (["--symbols", "--listeners", "--routes", "--conditions", "--files"].includes(selected)) {
  const field = { "--symbols": "symbols", "--listeners": "listeners", "--routes": "routeCandidates", "--conditions": "routeConditions" }[selected];
  const rows = field ? (field.startsWith("route") ? [...inspections, ...handlerInspections] : inspections).flatMap((item) => item[field]) : allFiles;
  for (const row of rows) console.log(Object.values(row).map((value) => String(value).replaceAll(/\s+/g, " ")).join("\t"));
} else if (selected === "--summary") {
  const summary = inspections.map((item) => ({
    file: item.file,
    ...primaryStats.find((stat) => stat.file === item.file),
    namedFunctions: item.symbols.filter((symbol) => symbol.kind !== "ClassDeclaration" && !symbol.name.startsWith("callback@")).length,
    anonymousCallbacks: item.symbols.filter((symbol) => symbol.name.startsWith("callback@")).length,
    classes: item.symbols.filter((symbol) => symbol.kind === "ClassDeclaration").length,
    eventAndTimerSites: item.listeners.length,
    apiPathLiteralOccurrences: item.routeCandidates.length,
    apiPathLiteralUnique: new Set(item.routeCandidates.map((item) => item.value)).size,
    imports: item.imports.length,
    stateKeys: item.stateKeys,
    longestFunctions: item.symbols.filter((symbol) => symbol.kind !== "ClassDeclaration").sort((a, b) => (b.endLine - b.line) - (a.endLine - a.line)).slice(0, 8).map(({ name, line, endLine }) => ({ name, line, lines: endLine - line + 1 }))
  }));
  console.log(JSON.stringify({ primary: summary, related: relatedStats, extractedHandlerPaths: handlerInspections.map((item) => ({ file: item.file, apiPathLiteralUnique: new Set(item.routeCandidates.map((entry) => entry.value)).size, routeConditions: item.routeConditions.length })), largestFiles: allFiles.slice(0, 20), largestBytes: [...allFiles].sort((a, b) => b.bytes - a.bytes).slice(0, 10), scannedFiles: allFiles.length }, null, 2));
} else {
  throw new Error(`Unknown option: ${selected}`);
}
