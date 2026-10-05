import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script = readFileSync(new URL('../backend/public/admin.js', import.meta.url), 'utf8');
const start = script.indexOf('function logCategoryLabel(');
const end = script.indexOf('function logDate(', start);
const present = runInNewContext(`${script.slice(start, end)}\nlogPresentation`);

test('historical performance recovery identifies the alert that ended', () => {
  const latency = present({event: 'performance.recovered', category: 'performance', metadata: {code: 'latency'}});
  const cpu = present({event: 'performance.recovered', category: 'performance', metadata: {code: 'cpu'}});
  assert.match(latency.title, /Tempo de resposta/);
  assert.match(latency.description, /tempo de resposta/);
  assert.match(cpu.title, /CPU/);
  assert.notEqual(cpu.title, latency.title);
});

test('an unknown event still shows its identity; known Studio activity has a readable description', () => {
  assert.match(present({event: 'social_studio.campaign_created', category: 'social_studio'}).description, /Campanha criada no Studio/);
  assert.match(present({event: 'custom.reconciliation_started', category: 'custom'}).description, /custom\.reconciliation_started/);
});

test('release e quedas exibem etapa e tipo em português com contexto de versão', () => {
  const failedRelease = present({
    event: 'deployment.failed',
    metadata: {
      failureStage: 'health_check',
      outageDetected: true,
      outageType: 'health_check_unreachable',
      attemptedVersion: '2.4.0+abc1234',
      cause: 'servidor não respondeu'
    }
  });
  assert.match(failedRelease.description, /checagem de disponibilidade/);
  assert.match(failedRelease.description, /servidor não respondeu à checagem/);
  assert.match(failedRelease.description, /2\.4\.0\+abc1234/);

  const recovered = present({
    event: 'service.outage.recovered',
    metadata: { outageType: 'process_exit_without_shutdown', outageDurationSeconds: 30 }
  });
  assert.match(recovered.description, /processo encerrou sem parada normal/);
  assert.match(recovered.description, /30 s/);
});

test('WhatsApp navigation and permission controls are removed', () => {
  const html = readFileSync(new URL('../backend/public/admin.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /class="nav-button"[^>]*admin\/whatsapp/);
  assert.doesNotMatch(html, /value="whatsapp\./);
  assert.doesNotMatch(script, /"whatsapp\.(view|reply|manage)"/);
});
