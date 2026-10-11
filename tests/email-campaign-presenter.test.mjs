import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createEmailCampaignPresenter } = require('../backend/services/emailCampaignPresenter.js');
const presenter = createEmailCampaignPresenter({ normalizeEmailBrand: (brand) => ({ ...brand, logoUrl: brand.logoUrl || '/logo.png' }) });

test('public campaign omits recipient, body and private attachment path', () => {
  const campaign = {
    id: 'campaign-1', subject: 'Sessao', customerIds: ['customer-1'],
    html: '<p>Private body</p>', message: 'Private message', contentBlocks: [{ type: 'text' }],
    attachments: [{ id: 'attachment-1', path: '/private/file.pdf', filename: 'file.pdf' }],
    recipientCount: 2, delivered: null, failed: 0
  };
  const projected = presenter.publicCampaign(campaign);
  assert.equal(projected.id, campaign.id);
  for (const key of ['customerIds', 'html', 'message', 'contentBlocks']) assert.equal(Object.hasOwn(projected, key), false);
  assert.deepEqual(projected.attachments, [{ id: 'attachment-1', filename: 'file.pdf' }]);
  assert.equal(projected.customerCount, 2);
  assert.equal(projected.hasHtml, true);
  assert.equal(projected.metricsSupported.delivered, false);
  assert.deepEqual(campaign.attachments[0], { id: 'attachment-1', path: '/private/file.pdf', filename: 'file.pdf' });
});

test('details retain editable campaign content but do not expose storage paths', () => {
  const details = presenter.campaignDetails({ id: 'campaign-2', message: 'Texto', html: '<p>Texto</p>',
    customerIds: ['customer-1'], attachments: [{ path: '/private/a.pdf', filename: 'a.pdf' }], brand: {} });
  assert.equal(details.message, 'Texto');
  assert.deepEqual(details.customerIds, ['customer-1']);
  assert.equal(details.brand.logoUrl, '/logo.png');
  assert.equal(Object.hasOwn(details.attachments[0], 'path'), false);
});
