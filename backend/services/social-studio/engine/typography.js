function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function visualLength(value = "") {
  return [...String(value)].reduce((total, character) => {
    if (/\s/.test(character)) return total + 0.34;
    if (/[I1il.,:;!|]/.test(character)) return total + 0.32;
    if (/[MW@%]/.test(character)) return total + 0.9;
    return total + 0.58;
  }, 0);
}

function fitFontSize(value, { width, preferred, min, max = preferred, letterSpacing = 0, lines = 1 } = {}) {
  const safeWidth = Math.max(1, Number(width || 1));
  const content = String(value || "");
  const characters = Math.max(1, visualLength(content));
  const spacingCost = Math.max(0, content.length - 1) * Math.max(0, letterSpacing);
  const calculated = (safeWidth - spacingCost) / (characters / Math.max(1, lines));
  return Math.round(clamp(Math.min(preferred, calculated), min, max));
}

function compactDate(value = "") {
  return String(value || "")
    .trim()
    .replace(/^previst[oa]\s+para\s+/i, "")
    .replace(/^a\s+partir\s+de\s+/i, "")
    .toUpperCase();
}

function compactWebsite(value = "") {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .slice(0, 80);
}

function splitLines(value = "", maxLines = 3, maxChars = 28) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || candidate.length <= maxChars) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.join(" ").length < String(value || "").trim().length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?]?$/, "")}…`;
  }
  return lines;
}

module.exports = { clamp, compactDate, compactWebsite, fitFontSize, splitLines, visualLength };
