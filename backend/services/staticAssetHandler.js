const fs = require("fs/promises");
const path = require("path");

function createStaticAssetHandler({
  stripPublicAssetBase, storageService, pathIsInside, sendJson, securityHeaders, MIME_TYPES,
  corsOrigin, readDb, getAdminUser, adminPathForRequest, PUBLIC_DIR, TRAILERS_DIR, FRONTEND_PUBLIC_DIR
}) {
  return async function serveStatic(req, res, pathname) {
    const uploadPublicPath = stripPublicAssetBase(pathname);
    if (uploadPublicPath.startsWith("/uploads/")) {
      const uploadPath = path.normalize(path.join(storageService.rootDir, uploadPublicPath.replace(/^\/uploads\//, "")));
      if (!pathIsInside(storageService.rootDir, uploadPath)) {
        sendJson(res, 403, { error: "Acesso negado" });
        return;
      }
  
      try {
        const file = await fs.readFile(uploadPath);
        const ext = path.extname(uploadPath).toLowerCase();
        res.writeHead(200, {
          ...securityHeaders(),
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Cache-Control": "public, max-age=300, must-revalidate"
        });
        res.end(file);
        return;
      } catch {
        sendJson(res, 404, { error: "Arquivo nao encontrado" });
        return;
      }
    }
  
    if (pathname.startsWith("/trailers/")) {
      const trailerPath = path.normalize(path.join(TRAILERS_DIR, pathname.replace(/^\/trailers\//, "")));
      if (!pathIsInside(TRAILERS_DIR, trailerPath)) {
        sendJson(res, 403, { error: "Acesso negado" });
        return;
      }
  
      try {
        const file = await fs.readFile(trailerPath);
        const ext = path.extname(trailerPath).toLowerCase();
        res.writeHead(200, {
          ...securityHeaders(),
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Access-Control-Allow-Origin": corsOrigin(),
          "Vary": "Origin",
          "Cache-Control": "public, max-age=86400"
        });
        res.end(file);
        return;
      } catch {
        sendJson(res, 404, { error: "Trailer nao encontrado" });
        return;
      }
    }
  
    if (pathname.startsWith("/images/")) {
      const imagePath = path.normalize(path.join(FRONTEND_PUBLIC_DIR, pathname));
      if (!pathIsInside(FRONTEND_PUBLIC_DIR, imagePath)) {
        sendJson(res, 403, { error: "Acesso negado" });
        return;
      }
  
      try {
        const file = await fs.readFile(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        res.writeHead(200, {
          ...securityHeaders(),
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Cache-Control": "public, max-age=86400"
        });
        res.end(file);
        return;
      } catch {
        sendJson(res, 404, { error: "Imagem nao encontrada" });
        return;
      }
    }
  
    const db = await readDb();
    const wantsAdminShell = pathname === "/admin" || pathname === "/admin/";
    const directAdminHtml = pathname === "/admin/admin.html";
    const authenticatedAdmin = getAdminUser(req, db);
    if (directAdminHtml && (!authenticatedAdmin || authenticatedAdmin.twoFactorSetupRequired)) {
      res.writeHead(302, { Location: adminPathForRequest(req) });
      res.end();
      return;
    }
    const relativePath = wantsAdminShell
      ? (authenticatedAdmin ? "admin.html" : "admin-login.html")
      : pathname.replace(/^\/admin\//, "");
    const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));
    if (!pathIsInside(PUBLIC_DIR, filePath)) {
      sendJson(res, 403, { error: "Acesso negado" });
      return;
    }
  
    try {
      const file = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        ...securityHeaders(),
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": pathname.startsWith("/admin") ? "no-store" : ext === ".html" ? "no-store" : "public, max-age=3600"
      });
      res.end(file);
    } catch {
      sendJson(res, 404, { error: "Arquivo nao encontrado" });
    }
  }
}

module.exports = { createStaticAssetHandler };
