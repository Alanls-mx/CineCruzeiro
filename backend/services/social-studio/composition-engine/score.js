const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
function scoreComposition(scene) {
  const issues = [],
    elements = scene.elements.filter((e) => e.visible !== false),
    texts = elements.filter((e) => e.type === "text" && e.text?.trim());
  const add = (code, penalty, id) =>
    issues.push({ code, penalty, elementId: id });
  const top =
      scene.formatId === "story" ? scene.height * 0.055 : scene.height * 0.025,
    bottom =
      scene.formatId === "story" ? scene.height * 0.91 : scene.height * 0.99;
  for (const text of texts) {
    if (
      text.x < scene.width * 0.025 ||
      text.x + text.width > scene.width * 0.975 ||
      text.y < top ||
      text.y + text.height > bottom
    )
      add("SAFE_AREA", 18, text.id);
    if (text.fontSize < 18 && !["website", "cinema"].includes(text.id))
      add("SMALL_TEXT", 12, text.id);
    if (
      text.text.split("\n").length * text.fontSize * text.lineHeight >
      text.height + 1
    )
      add("TEXT_OVERFLOW", 30, text.id);
    if (text.contrastRatio && text.contrastRatio < 4.5)
      add("LOW_CONTRAST", 18, text.id);
  }
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++)
      if (overlap(texts[i], texts[j]) > 4)
        add("TEXT_OVERLAP", 25, `${texts[i].id}/${texts[j].id}`);
  const art = elements.find((e) => e.id === "artwork"),
    bg = elements.find((e) => e.id === "background-blur");
  if (!art && !bg) add("NO_ARTWORK", 15, "artwork");
  if (art) {
    const protectedZone = {
      x: art.x + art.width * 0.16,
      y: art.y + art.height * 0.15,
      width: art.width * 0.68,
      height: art.height * 0.62,
    };
    for (const text of texts)
      if (overlap(protectedZone, text) > text.width * text.height * 0.12)
        add("SUBJECT_OVERLAP", 20, text.id);
    if (art.width * art.height < scene.width * scene.height * 0.1)
      add("SMALL_ARTWORK", 15, art.id);
  }
  const logo = elements.find((e) => e.role === "logo");
  if (
    logo &&
    (logo.width < scene.width * 0.13 || logo.height < scene.height * 0.04)
  )
    add("SMALL_LOGO", 12, logo.id);
  const score = Math.max(
    0,
    100 - issues.reduce((sum, issue) => sum + issue.penalty, 0),
  );
  return {
    score,
    accepted:
      score >= 75 &&
      !issues.some((i) =>
        ["TEXT_OVERLAP", "TEXT_OVERFLOW", "SUBJECT_OVERLAP"].includes(i.code),
      ),
    issues,
    method: "layout-contrast-heuristic-v1",
  };
}
module.exports = { scoreComposition };
