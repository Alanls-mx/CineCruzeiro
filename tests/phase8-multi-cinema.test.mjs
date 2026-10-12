import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateRegistry } from '../scripts/cinema-instance-registry.mjs';

const registry = validateRegistry(JSON.parse(fs.readFileSync(new URL('../config/cinema-instances.example.json', import.meta.url), 'utf8')));
const expected = new Map([
  ['cinecruzeiro', 'Cine Cruzeiro'],
  ['cine-estacao-amparo', 'Cine Estação Amparo'],
  ['cinemax-piraju', 'Cinemax Piraju'],
  ['cine-gama', 'Cine Gama'],
  ['cinemania-cosmopolis', 'CineMania Cosmópolis']
]);

test('cinco instalacoes possuem identidade e endereco sinteticos distintos', () => {
  const selected = registry.instances.filter((item) => expected.has(item.slug));
  assert.equal(selected.length, expected.size);
  assert.deepEqual(registry.instances.filter((item) => item.enabled).map((item) => item.slug), ['cinecruzeiro']);
  assert.equal(registry.instances.find((item) => item.slug === 'cine-romeu')?.enabled, false);
  for (const item of selected) {
    assert.equal(item.name, expected.get(item.slug));
    assert.equal(item.siteUrl.endsWith(item.route), true);
    assert.equal(item.applyBrand, item.slug !== 'cinecruzeiro');
  }
  for (const field of ['route', 'siteUrl', 'baseDir', 'frontendPort', 'backendPort', 'frontendProcess', 'backendProcess']) {
    assert.equal(new Set(selected.map((item) => item[field])).size, selected.length, `${field} compartilhado entre instalacoes`);
  }
  assert.equal(selected.some((item) => Object.keys(item).some((key) => /secret|token|password|databaseUrl/i.test(key))), false);
});

for (const [slug, name] of expected) {
  if (slug === 'cinecruzeiro') continue;
  test(`marca sintetica isolada: ${slug}`, () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cine-phase8-brand-'));
    try {
      fs.mkdirSync(path.join(temp, 'src'), { recursive: true });
      fs.writeFileSync(path.join(temp, 'src', 'brand.ts'), 'export const brand = "Cine Cruzeiro /projects/cinecruzeiro @cinecruzeiro";');
      const item = registry.instances.find((entry) => entry.slug === slug);
      const result = spawnSync(process.execPath, [
        path.resolve('scripts/apply-instance-brand.mjs'), '--root', temp,
        '--old-name', 'Cine Cruzeiro', '--name', name, '--route', item.route,
        '--city', item.city
      ], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const branded = fs.readFileSync(path.join(temp, 'src', 'brand.ts'), 'utf8');
      assert.match(branded, new RegExp(item.route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(branded.includes(name), true);
      assert.equal(branded.includes('Cine Cruzeiro'), false);
      for (const other of expected.values()) {
        if (other !== name) assert.equal(branded.includes(other), false);
      }
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
}
