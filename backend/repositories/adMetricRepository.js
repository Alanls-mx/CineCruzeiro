const { queryPostgres, invalidatePostgresSnapshot } = require("../db/postgresStore");

async function increment(id, metric) {
  const counter = metric === "click" ? "clicks" : "impressions";
  const timestamp = metric === "click" ? "lastClickAt" : "lastImpressionAt";
  const result = await queryPostgres(`
    UPDATE ads
    SET metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        $2::text,
        COALESCE(NULLIF(metadata ->> $2::text, '')::bigint, 0) + 1,
        $3::text,
        to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    WHERE id = $1
    RETURNING metadata
  `, [id, counter, timestamp]);
  if (result.rowCount) invalidatePostgresSnapshot();
  return result.rows[0]?.metadata || null;
}

module.exports = { increment };
