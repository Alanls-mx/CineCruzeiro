const { performance } = require("perf_hooks");
const legacy = require("../../socialStudioService");
const { renderSocialPostV2 } = require("../engine/renderer");

async function generateSocialCampaign(request = {}, context = {}, options = {}) {
  const startedAt = performance.now();
  const templateId = request.template || request.templateId || "movie-premiere";
  const subject = request.subject && typeof request.subject === "object" ? request.subject : request;
  const formats = Array.isArray(request.formats) && request.formats.length
    ? request.formats.filter((id) => legacy.SOCIAL_FORMATS[id])
    : Object.keys(legacy.SOCIAL_FORMATS);
  const items = await Promise.all(formats.map((formatId) => renderSocialPostV2({
    ...subject,
    templateId,
    formatId
  }, { ...context, brand: request.cinema || context.brand }, options)));
  return {
    rendererVersion: "v2",
    items,
    metrics: {
      formats: items.length,
      totalMs: Number((performance.now() - startedAt).toFixed(1)),
      averageMs: Number((items.reduce((sum, item) => sum + Number(item.metrics?.renderMs || 0), 0) / Math.max(1, items.length)).toFixed(1))
    }
  };
}

module.exports = { generateSocialCampaign };
