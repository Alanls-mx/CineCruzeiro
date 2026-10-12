import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const scopes = ['backend/server.js', 'backend/services', 'backend/repositories', 'backend/public/admin-modules', 'src/components'];
const extensions = new Set(['.js', '.ts', '.tsx']);

async function sourceFiles(relative) {
  const absolute = path.join(root, relative);
  const stat = await fs.stat(absolute);
  if (stat.isFile()) return [absolute];
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return entry.isFile() && extensions.has(path.extname(entry.name)) ? [path.join(root, child)] : [];
  }));
  return groups.flat();
}

const files = (await Promise.all(scopes.map(sourceFiles))).flat();
let namedCallables = 0;
for (const file of files) {
  const source = await fs.readFile(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) namedCallables += 1;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
        && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) namedCallables += 1;
    ts.forEachChild(node, visit);
  }
  visit(tree);
}

const symbols = await fs.readFile(path.join(root, 'docs/architecture/symbols.md'), 'utf8');
const endpoints = await fs.readFile(path.join(root, 'docs/architecture/endpoints.md'), 'utf8');
const server = await fs.readFile(path.join(root, 'backend/server.js'), 'utf8');
const curatedSymbols = [...symbols.matchAll(/^\| `([A-Za-z_$][\w$]*)` \|/gm)].length;
const curatedEndpoints = [...endpoints.matchAll(/^\| `(GET|POST|PUT|PATCH|DELETE) \/api\//gm)].length;
const apiPathLiterals = new Set([...server.matchAll(/["'`]((?:\/api\/)[^"'`\s]+)["'`]/g)].map((match) => match[1]));

console.log(JSON.stringify({
  scope: scopes,
  sourceFiles: files.length,
  namedCallables,
  curatedSymbols,
  curatedEndpoints,
  serverApiPathLiterals: apiPathLiterals.size,
  caveat: 'Callables incluem funcoes internas; literais incluem referencias nao registradas. Nao sao denominadores de cobertura funcional ou inventario de rotas ativas.'
}, null, 2));
