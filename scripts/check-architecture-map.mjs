import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = ['AGENTS.md', ...((await fs.readdir(path.join(root, 'docs/architecture')))
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
if (broken.length) {
  console.error(broken.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Mapa: ${files.length} documentos, links locais existentes.`);
}
