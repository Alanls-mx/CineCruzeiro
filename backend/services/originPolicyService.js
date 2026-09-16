function canonicalOrigin(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : "";
  } catch {
    return text.replace(/\/+$/, "");
  }
}

function allowedOrigins(value, fallback = "http://localhost:3000") {
  return [...new Set(String(value || fallback)
    .split(",")
    .map(canonicalOrigin)
    .filter(Boolean))];
}

module.exports = { allowedOrigins, canonicalOrigin };
