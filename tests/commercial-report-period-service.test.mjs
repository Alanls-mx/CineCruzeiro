import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCommercialReportPeriodService } = require('../backend/services/commercialReportPeriodService.js');
const { isValidCalendarDate } = require('../backend/services/calendarDateService.js');
const period = createCommercialReportPeriodService({
  todayIsoDate: () => '2026-10-10',
  isValidCalendarDate,
  datePartsInSaoPaulo: () => ({ year: 2026, month: 10, day: 9 })
});

test('período comercial conserva intervalos, janela anterior e validação', () => {
  const seven = period.parseAdminPeriod(new URL('http://local/?period=7d'));
  assert.deepEqual(seven, { period: '7d', start: '2026-10-04', end: '2026-10-10', days: 7,
    previousStart: '2026-09-27', previousEnd: '2026-10-03' });
  const custom = period.parseAdminPeriod(new URL('http://local/?period=custom&from=2026-10-08&to=2026-10-09'));
  assert.equal(custom.days, 2);
  assert.throws(() => period.parseAdminPeriod(new URL('http://local/?period=custom&from=2026-10-10&to=2026-10-09')), { statusCode: 422 });
  assert.throws(() => period.parseAdminPeriod(new URL('http://local/?period=custom&from=2025-01-01&to=2026-10-10')), { statusCode: 422 });
});

test('filtro de datas e comparação preservam resultados financeiros de apresentação', () => {
  assert.ok(period.inDateRange('2026-10-09T23:00:00Z', '2026-10-09', '2026-10-09'));
  assert.equal(period.inDateRange('', '2026-10-09', '2026-10-09'), '');
  assert.equal(period.compareMetric(15, 10), 50);
  assert.equal(period.compareMetric(0, 0), 0);
  assert.equal(period.compareMetric(1, 0), 100);
});
