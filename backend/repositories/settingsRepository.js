const { timedQuery, runMutation } = require("./repositorySupport");

async function getAppSettings() {
  const result = await timedQuery(null, "SELECT value FROM settings WHERE key='app'", [], { repository: "settings", operation: "get" });
  return result.rows[0]?.value || {};
}

async function patchAppSettings(patch, options = {}) {
  const clean = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  return runMutation({
    event: "repository.settings.patch",
    metadata: { repository: "settings", operation: "patch", keys: Object.keys(clean).join(",") },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, `INSERT INTO settings (key,value,updated_at)
      VALUES ('app',$1::jsonb,now())
      ON CONFLICT (key) DO UPDATE SET value=COALESCE(settings.value,'{}'::jsonb) || EXCLUDED.value,updated_at=now()
      RETURNING value`, [JSON.stringify(clean)], { repository: "settings", operation: "patch" });
    return result.rows[0]?.value || {};
  });
}

function updateSection(section, value, options = {}) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(String(section || ""))) {
    throw Object.assign(new Error("Seção de configuração inválida."), { statusCode: 422, code: "SETTINGS_SECTION_INVALID" });
  }
  return patchAppSettings({ [section]: value }, options);
}

async function updateSectionKey(section, key, value, options = {}) {
  if (![section, key].every((part) => /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(String(part || "")))) {
    throw Object.assign(new Error("Caminho de configuração inválido."), { statusCode: 422, code: "SETTINGS_PATH_INVALID" });
  }
  const safeValue = value === undefined ? {} : value;
  return runMutation({
    event: "repository.settings.patch",
    metadata: { repository: "settings", operation: "patchKey", section, key },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, `INSERT INTO settings (key,value,updated_at)
      VALUES ('app',jsonb_build_object($1::text,jsonb_build_object($2::text,$3::jsonb)),now())
      ON CONFLICT (key) DO UPDATE SET value=jsonb_set(
        jsonb_set(
          COALESCE(settings.value,'{}'::jsonb),
          ARRAY[$1::text],
          CASE WHEN jsonb_typeof(settings.value->($1::text))='object' THEN settings.value->($1::text) ELSE '{}'::jsonb END,
          true
        ),
        ARRAY[$1::text,$2::text],$3::jsonb,true
      ),updated_at=now()
      RETURNING value`, [section, key, JSON.stringify(safeValue)], { repository: "settings", operation: "patchKey" });
    return result.rows[0]?.value || {};
  });
}

async function prependArrayItem(section, item, limit = 100, options = {}) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(String(section || ""))) {
    throw Object.assign(new Error("Seção de configuração inválida."), { statusCode: 422, code: "SETTINGS_SECTION_INVALID" });
  }
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));
  return runMutation({
    event: "repository.settings.prepend",
    metadata: { repository: "settings", operation: "prepend", section },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, `INSERT INTO settings (key,value,updated_at)
      VALUES ('app',jsonb_build_object($1::text,jsonb_build_array($2::jsonb)),now())
      ON CONFLICT (key) DO UPDATE SET value=jsonb_set(COALESCE(settings.value,'{}'::jsonb),ARRAY[$1::text],
        (SELECT COALESCE(jsonb_agg(entry.value ORDER BY entry.ordinality),'[]'::jsonb)
         FROM (SELECT value,ordinality
           FROM jsonb_array_elements(jsonb_build_array($2::jsonb) || COALESCE(settings.value->($1::text),'[]'::jsonb)) WITH ORDINALITY
           LIMIT $3::int) entry),true),updated_at=now()
      RETURNING value`, [section, JSON.stringify(item), safeLimit], { repository: "settings", operation: "prepend" });
    return result.rows[0]?.value || {};
  });
}

module.exports = { getAppSettings, patchAppSettings, updateSection, updateSectionKey, prependArrayItem };
