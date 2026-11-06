const fs = require("fs/promises");
const path = require("path");

function createDesktopUpdateHandler({ PUBLIC_DIR, pathIsInside, sendJson, securityHeaders, MIME_TYPES }) {
  return async function serveDesktopUpdate(res, pathname) {
    const updateRoot = path.join(PUBLIC_DIR, "downloads", "desktop");
    const relativePath = pathname.replace(/^\/api\/desktop\/update\/?/, "");
    const filePath = path.normalize(path.join(updateRoot, relativePath));
    if (!relativePath || !pathIsInside(updateRoot, filePath)) {
      sendJson(res, 404, { error: "Atualização não encontrada" });
      return;
    }

    try {
      const file = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        ...securityHeaders(),
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": relativePath === "latest.ini" ? "no-store" : "public, max-age=31536000, immutable"
      });
      res.end(file);
    } catch {
      sendJson(res, 404, { error: "Atualização não encontrada" });
    }
  }
}

module.exports = { createDesktopUpdateHandler };
