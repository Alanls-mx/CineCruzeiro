import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = ['AGENTS.md', 'docs/FASE10_PRE_HOMOLOGACAO.md', 'docs/FASE10_CADERNO_PILOTO.md', 'docs/FASE11_HOMOLOGACAO_PILOTO.md', 'docs/FASE11_AUTORIZACAO_SANDBOX.md', ...((await fs.readdir(path.join(root, 'docs/architecture')))
  .filter(name => name.endsWith('.md')).map(name => `docs/architecture/${name}`))];
const broken = [];
for (const file of files) {
  const content = await fs.readFile(path.join(root, file), 'utf8');
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const resolved = path.resolve(root, path.dirname(file), decodeURIComponent(target));
    if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
      broken.push(`${file}: caminho fora do repositorio: ${target}`);
      continue;
    }
    try { await fs.stat(resolved); } catch { broken.push(`${file}: arquivo ausente: ${target}`); }
  }
}
const symbolsDoc = await fs.readFile(path.join(root, 'docs/architecture/symbols.md'), 'utf8');
for (const line of symbolsDoc.split(/\r?\n/)) {
  const match = line.match(/^\| `([A-Za-z_$][\w$]*)` \| \[[^\]]+\]\(([^)]+)\) \|/);
  if (!match) continue;
  const [, symbol, relative] = match;
  const sourcePath = path.resolve(root, 'docs/architecture', relative);
  let source;
  try { source = await fs.readFile(sourcePath, 'utf8'); } catch { continue; }
  const tree = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true,
    sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : sourcePath.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  let found = false;
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isMethodDeclaration(node))
      && node.name?.text === symbol) found = true;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === symbol) found = true;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!found) broken.push(`docs/architecture/symbols.md: simbolo ausente em ${relative}: ${symbol}`);
}
if (broken.length) {
  console.error(broken.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Mapa: ${files.length} documentos, links locais existentes.`);
}
