const { timedQuery, runMutation } = require("./repositorySupport");

const COLUMN_KEYS = new Set([
  "id", "title", "description", "discountType", "value", "couponCode",
  "startsAt", "endsAt", "active", "createdAt", "updatedAt"
]);

function promotionMetadata(promotion = {}) {
  return Object.fromEntries(Object.entries(promotion).filter(([key]) => !COLUMN_KEYS.has(key)));
}

function mapPromotion(row) {
  if (!row) return null;
  return {
    ...(row.metadata || {}),
    id: row.id,
    title: row.title,
    description: row.description || "",
    discountType: row.discount_type,
    value: Number(row.value || 0),
    couponCode: row.coupon_code || "",
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : "",
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : "",
    active: row.active !== false,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
  };
}

function params(promotion) {
  return [
    promotion.id, promotion.title, promotion.description || "",
    promotion.discountType || "amount", Number(promotion.value || 0),
    promotion.couponCode || "", promotion.startsAt || "", promotion.endsAt || "",
    promotion.active !== false, JSON.stringify(promotionMetadata(promotion)),
    promotion.createdAt || ""
  ];
}

async function findById(id) {
  const result = await timedQuery(null, "SELECT * FROM promotions WHERE id = $1", [id], { repository: "promotion", operation: "findById" });
  return mapPromotion(result.rows[0]);
}

async function findByCouponCode(code) {
  const result = await timedQuery(null,
    "SELECT * FROM promotions WHERE upper(coupon_code) = upper($1) LIMIT 1",
    [String(code || "")],
    { repository: "promotion", operation: "findByCouponCode" }
  );
  return mapPromotion(result.rows[0]);
}

async function create(promotion, options = {}) {
  return runMutation({
    event: "repository.promotion.create",
    metadata: { repository: "promotion", operation: "create", promotionId: promotion.id },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, `INSERT INTO promotions
      (id, title, description, discount_type, value, coupon_code, starts_at, ends_at, active, metadata, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,'')::timestamptz,NULLIF($8,'')::timestamptz,$9,$10::jsonb,COALESCE(NULLIF($11,'')::timestamptz,now()),now())
      ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description,
        discount_type=EXCLUDED.discount_type, value=EXCLUDED.value, coupon_code=EXCLUDED.coupon_code,
        starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, active=EXCLUDED.active,
        metadata=EXCLUDED.metadata, updated_at=now()
      RETURNING *`, params(promotion), { repository: "promotion", operation: "create" });
    return mapPromotion(result.rows[0]);
  });
}

async function update(promotion, options = {}) {
  return runMutation({
    event: "repository.promotion.update",
    metadata: { repository: "promotion", operation: "update", promotionId: promotion.id },
    audit: options.audit
  }, async (client) => {
    const values = params(promotion);
    const result = await timedQuery(client, `UPDATE promotions SET
      title=$2,description=$3,discount_type=$4,value=$5,coupon_code=NULLIF($6,''),
      starts_at=NULLIF($7,'')::timestamptz,ends_at=NULLIF($8,'')::timestamptz,
      active=$9,metadata=$10::jsonb,updated_at=now()
      WHERE id=$1 RETURNING *`, values.slice(0, 10), { repository: "promotion", operation: "update" });
    return mapPromotion(result.rows[0]);
  });
}

async function setActive(id, active, options = {}) {
  return runMutation({
    event: "repository.promotion.active",
    metadata: { repository: "promotion", operation: "setActive", promotionId: id },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client,
      "UPDATE promotions SET active=$2, updated_at=now() WHERE id=$1 RETURNING *",
      [id, Boolean(active)], { repository: "promotion", operation: "setActive" });
    return mapPromotion(result.rows[0]);
  });
}

async function remove(id, options = {}) {
  return runMutation({
    event: "repository.promotion.delete",
    metadata: { repository: "promotion", operation: "delete", promotionId: id },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, "DELETE FROM promotions WHERE id=$1 RETURNING *", [id], { repository: "promotion", operation: "delete" });
    return mapPromotion(result.rows[0]);
  });
}

async function removeCampaignCoupon(campaignId, couponId = "") {
  return runMutation({
    event: "repository.promotion.campaign_delete",
    metadata: { repository: "promotion", operation: "campaignDelete", campaignId }
  }, async (client) => {
    const result = await timedQuery(client, `DELETE FROM promotions
      WHERE metadata->>'autoManagedByCampaign' = 'true'
        AND metadata->>'sourceCampaignId' = $1
        AND ($2 = '' OR id = $2)
      RETURNING *`, [String(campaignId || ""), String(couponId || "")], { repository: "promotion", operation: "campaignDelete" });
    return mapPromotion(result.rows[0]);
  });
}

module.exports = { mapPromotion, findById, findByCouponCode, create, update, setActive, remove, removeCampaignCoupon };
