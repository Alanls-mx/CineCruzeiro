CREATE TABLE IF NOT EXISTS email_campaigns (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE,
  subject TEXT NOT NULL,
  preheader TEXT NOT NULL DEFAULT '',
  kicker TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL DEFAULT '',
  template_id TEXT NOT NULL DEFAULT 'announcement',
  mode TEXT NOT NULL DEFAULT 'template' CHECK (mode IN ('template', 'html', 'legacy_visual')),
  recipient_mode TEXT NOT NULL DEFAULT 'all' CHECK (recipient_mode IN ('all', 'selected', 'purchased', 'recent', 'reactivation', 'birthday_manual')),
  recipient_search TEXT NOT NULL DEFAULT '',
  selected_customer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  reactivation_days INTEGER NOT NULL DEFAULT 90 CHECK (reactivation_days BETWEEN 30 AND 730),
  coupon_id TEXT NOT NULL DEFAULT '',
  movie_id TEXT NOT NULL DEFAULT '',
  concession_id TEXT NOT NULL DEFAULT '',
  concession_ids TEXT[] NOT NULL DEFAULT '{}',
  club_plan_id TEXT NOT NULL DEFAULT '',
  club_offer TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  image_link TEXT NOT NULL DEFAULT '',
  accent_color TEXT NOT NULL DEFAULT '#facc15',
  headline_color TEXT NOT NULL DEFAULT '#ffffff',
  text_color TEXT NOT NULL DEFAULT '#dbeafe',
  button_color TEXT NOT NULL DEFAULT '#facc15',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  brand_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  legacy_content JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'queued', 'sending', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
  schedule_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failure_reason TEXT NOT NULL DEFAULT '',
  requested_recipient_count INTEGER NOT NULL DEFAULT 0,
  eligible_recipient_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER,
  bounced_count INTEGER,
  opened_count INTEGER,
  clicked_count INTEGER,
  ai_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  eligibility_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  worker_id TEXT,
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status_schedule ON email_campaigns(status, schedule_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at ON email_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_by ON email_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_template ON email_campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_movie ON email_campaigns(movie_id) WHERE movie_id <> '';
CREATE INDEX IF NOT EXISTS idx_email_campaigns_coupon ON email_campaigns(coupon_id) WHERE coupon_id <> '';
CREATE INDEX IF NOT EXISTS idx_email_campaigns_club_plan ON email_campaigns(club_plan_id) WHERE club_plan_id <> '';
CREATE INDEX IF NOT EXISTS idx_email_campaigns_concession ON email_campaigns(concession_id) WHERE concession_id <> '';
CREATE INDEX IF NOT EXISTS idx_email_campaigns_worker_lease ON email_campaigns(status, heartbeat_at) WHERE status = 'sending';

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recipient_key TEXT NOT NULL,
  email TEXT NOT NULL,
  name_snapshot TEXT NOT NULL DEFAULT '',
  delivery_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'retryable_failed', 'failed', 'unknown', 'suppressed', 'cancelled')),
  suppression_reason TEXT NOT NULL DEFAULT '',
  eligibility_reason TEXT NOT NULL DEFAULT '',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  manual_retry_granted BOOLEAN NOT NULL DEFAULT false,
  next_attempt_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  worker_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_error_code TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  provider_message_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, recipient_key)
);

ALTER TABLE email_campaign_recipients
  ADD COLUMN IF NOT EXISTS manual_retry_granted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_recipients_campaign_status ON email_campaign_recipients(campaign_id, status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_email_recipients_worker_lease ON email_campaign_recipients(status, locked_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_email_recipients_customer ON email_campaign_recipients(customer_id);

CREATE TABLE IF NOT EXISTS email_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  campaign_recipient_id UUID NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  provider TEXT NOT NULL,
  provider_message_id TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'sent', 'retryable_failed', 'failed', 'unknown', 'skipped')),
  retryable BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (campaign_recipient_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_email_attempts_campaign ON email_delivery_attempts(campaign_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_attempts_recipient ON email_delivery_attempts(campaign_recipient_id, attempt_number DESC);
CREATE INDEX IF NOT EXISTS idx_email_attempts_delivery ON email_delivery_attempts(delivery_id);

CREATE TABLE IF NOT EXISTS email_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  campaign_recipient_id UUID REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  delivery_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  provider_event_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('accepted', 'delivered', 'soft_bounce', 'hard_bounce', 'complained', 'opened', 'clicked')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_events_campaign_type ON email_delivery_events(campaign_id, event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS email_marketing_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  marketing_email_enabled BOOLEAN NOT NULL DEFAULT true,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'legacy_account',
  consent_version TEXT NOT NULL DEFAULT 'legacy-v1',
  reason TEXT NOT NULL DEFAULT '',
  unsubscribe_token_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_marketing_enabled ON email_marketing_preferences(marketing_email_enabled);

CREATE TABLE IF NOT EXISTS email_unsubscribe_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 years'),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribe_tokens_user ON email_unsubscribe_tokens(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS email_suppressions (
  email_hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unsubscribe',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO email_unsubscribe_tokens (token_hash, user_id, created_at, expires_at)
SELECT
  encode(digest(email_unsubscribe_token, 'sha256'), 'hex'),
  id,
  COALESCE(updated_at, created_at, now()),
  now() + interval '2 years'
FROM users
WHERE COALESCE(email_unsubscribe_token, '') <> ''
ON CONFLICT (token_hash) DO NOTHING;

INSERT INTO email_suppressions (email_hash, reason, source, created_at, updated_at)
SELECT
  encode(digest(lower(trim(email)), 'sha256'), 'hex'),
  'legacy_unsubscribe',
  'legacy_account',
  COALESCE(email_unsubscribed_at, now()),
  COALESCE(email_unsubscribed_at, now())
FROM users
WHERE email_unsubscribed_at IS NOT NULL AND COALESCE(trim(email), '') <> ''
ON CONFLICT (email_hash) DO NOTHING;

INSERT INTO email_marketing_preferences (
  user_id, marketing_email_enabled, opted_in_at, opted_out_at, source,
  consent_version, unsubscribe_token_hash, created_at, updated_at
)
SELECT
  id,
  email_unsubscribed_at IS NULL,
  CASE WHEN email_unsubscribed_at IS NULL THEN created_at ELSE NULL END,
  email_unsubscribed_at,
  'legacy_account',
  'legacy-v1',
  CASE WHEN COALESCE(email_unsubscribe_token, '') <> '' THEN encode(digest(email_unsubscribe_token, 'sha256'), 'hex') ELSE NULL END,
  created_at,
  updated_at
FROM users
ON CONFLICT (user_id) DO NOTHING;

WITH legacy AS (
  SELECT campaign
  FROM settings,
       LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(value->'emailCampaigns') = 'array' THEN value->'emailCampaigns' ELSE '[]'::jsonb END) AS campaign
  WHERE key = 'app'
)
INSERT INTO email_campaigns (
  id, idempotency_key, subject, preheader, kicker, headline, message, html, template_id,
  mode, recipient_mode, recipient_search, selected_customer_ids, coupon_id,
  movie_id, concession_id, concession_ids, club_plan_id, club_offer, image_url,
  image_alt, image_link, accent_color, headline_color, text_color, button_color, cta_label,
  cta_url, variables, brand_snapshot, attachments, legacy_content, status,
  schedule_at, created_by, created_at, updated_at, started_at, completed_at,
  failure_reason, requested_recipient_count, eligible_recipient_count,
  processed_count, sent_count, failed_count, delivered_count, bounced_count, opened_count,
  clicked_count, ai_metadata, eligibility_snapshot
)
SELECT
  campaign->>'id',
  NULLIF(campaign->>'idempotencyKey', ''),
  COALESCE(campaign->>'subject', 'Campanha sem assunto'),
  COALESCE(campaign->>'preheader', ''),
  COALESCE(campaign->>'kicker', ''),
  COALESCE(campaign->>'headline', ''),
  COALESCE(campaign->>'message', ''),
  COALESCE(campaign->>'html', ''),
  COALESCE(NULLIF(campaign->>'templateId', ''), 'announcement'),
  CASE WHEN campaign->>'mode' = 'visual' THEN 'legacy_visual' WHEN campaign->>'mode' = 'html' THEN 'html' ELSE 'template' END,
  CASE WHEN campaign->>'recipientMode' = 'active' THEN 'recent' WHEN campaign->>'recipientMode' IN ('all', 'selected', 'purchased', 'recent', 'reactivation', 'birthday_manual') THEN campaign->>'recipientMode' ELSE 'all' END,
  COALESCE(campaign->>'recipientSearch', ''),
  CASE WHEN jsonb_typeof(campaign->'customerIds') = 'array' THEN campaign->'customerIds' ELSE '[]'::jsonb END,
  COALESCE(campaign->>'couponId', ''),
  COALESCE(campaign->>'movieId', ''),
  COALESCE(campaign->>'concessionId', ''),
  ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(campaign->'concessionIds') = 'array' THEN campaign->'concessionIds' ELSE '[]'::jsonb END)),
  COALESCE(campaign->>'clubPlanId', ''),
  COALESCE(campaign->>'clubOffer', ''),
  COALESCE(campaign->>'imageUrl', ''),
  COALESCE(campaign->>'imageAlt', ''),
  COALESCE(campaign->>'imageLink', ''),
  COALESCE(NULLIF(campaign->>'accentColor', ''), '#facc15'),
  COALESCE(NULLIF(campaign->>'headlineColor', ''), '#ffffff'),
  COALESCE(NULLIF(campaign->>'textColor', ''), '#dbeafe'),
  COALESCE(NULLIF(campaign->>'buttonColor', ''), '#facc15'),
  COALESCE(campaign->>'ctaLabel', ''),
  COALESCE(campaign->>'ctaUrl', ''),
  CASE WHEN jsonb_typeof(campaign->'variables') = 'object' THEN campaign->'variables' ELSE '{}'::jsonb END,
  CASE WHEN jsonb_typeof(campaign->'brand') = 'object' THEN campaign->'brand' ELSE '{}'::jsonb END,
  CASE WHEN jsonb_typeof(campaign->'attachments') = 'array' THEN campaign->'attachments' ELSE '[]'::jsonb END,
  CASE WHEN campaign->>'mode' = 'visual' OR (jsonb_typeof(campaign->'contentBlocks') = 'array' AND jsonb_array_length(campaign->'contentBlocks') > 0) THEN jsonb_build_object('contentBlocks', CASE WHEN jsonb_typeof(campaign->'contentBlocks') = 'array' THEN campaign->'contentBlocks' ELSE '[]'::jsonb END) ELSE NULL END,
  CASE campaign->>'status' WHEN 'sent' THEN CASE WHEN COALESCE((campaign->>'failed')::integer, 0) > 0 THEN 'completed_with_errors' ELSE 'completed' END WHEN 'draft' THEN 'draft' WHEN 'scheduled' THEN 'scheduled' WHEN 'queued' THEN 'queued' WHEN 'sending' THEN 'sending' WHEN 'failed' THEN 'failed' WHEN 'cancelled' THEN 'cancelled' ELSE 'draft' END,
  NULLIF(campaign->>'scheduleAt', '')::timestamptz,
  NULLIF(campaign->>'createdBy', ''),
  COALESCE(NULLIF(campaign->>'createdAt', '')::timestamptz, now()),
  COALESCE(NULLIF(campaign->>'updatedAt', '')::timestamptz, now()),
  NULLIF(campaign->>'startedAt', '')::timestamptz,
  NULLIF(campaign->>'completedAt', '')::timestamptz,
  COALESCE(campaign->>'error', ''),
  COALESCE(NULLIF(campaign->>'recipientCount', '')::integer, 0),
  COALESCE(NULLIF(campaign->>'recipientCount', '')::integer, 0),
  COALESCE(NULLIF(campaign->>'sent', '')::integer, 0) + COALESCE(NULLIF(campaign->>'failed', '')::integer, 0),
  COALESCE(NULLIF(campaign->>'sent', '')::integer, 0),
  COALESCE(NULLIF(campaign->>'failed', '')::integer, 0),
  CASE WHEN campaign ? 'delivered' THEN NULLIF(campaign->>'delivered', '')::integer ELSE NULL END,
  CASE WHEN campaign ? 'bounced' THEN NULLIF(campaign->>'bounced', '')::integer ELSE NULL END,
  CASE WHEN campaign ? 'opened' THEN NULLIF(campaign->>'opened', '')::integer ELSE NULL END,
  CASE WHEN campaign ? 'clicked' THEN NULLIF(campaign->>'clicked', '')::integer ELSE NULL END,
  jsonb_strip_nulls(jsonb_build_object(
    'generated', campaign->'aiGenerated', 'provider', campaign->'aiProvider',
    'requestedProvider', campaign->'aiProviderRequested', 'model', campaign->'aiModel',
    'configuredModel', campaign->'aiConfiguredModel', 'modelResolutionReason', campaign->'aiModelResolutionReason',
    'fallbackReason', campaign->'aiFallbackReason', 'fallbackMessage', campaign->'aiFallbackMessage', 'scenario', campaign->'aiScenario',
    'context', campaign->'aiContext', 'referenceCampaignId', campaign->'aiReferenceCampaignId',
    'referenceTemplateId', campaign->'aiReferenceTemplateId', 'brief', campaign->'aiBrief'
  )),
  CASE
    WHEN jsonb_typeof(campaign->'eligibility') = 'object' THEN campaign->'eligibility'
    WHEN jsonb_typeof(campaign->'aiEligibility') = 'object' THEN campaign->'aiEligibility'
    ELSE '{}'::jsonb
  END
FROM legacy
WHERE COALESCE(campaign->>'id', '') <> ''
ON CONFLICT DO NOTHING;

UPDATE settings
SET value = value - 'emailCampaigns', updated_at = now()
WHERE key = 'app' AND value ? 'emailCampaigns';
