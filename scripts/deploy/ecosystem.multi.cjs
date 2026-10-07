const path = require("node:path");

// Copie este template como ecosystem.config.cjs na raiz da instancia na VPS.
const baseDir = process.env.CINEMA_INSTANCE_DIR || __dirname;
const slug = path.basename(baseDir);
const ports = {
  "cinemax-piraju": [3110, 4110],
  "cine-gama": [3130, 4130],
  "cinemania-cosmopolis": [3140, 4140],
};
if (!ports[slug]) throw new Error(`Instância desconhecida: ${slug}`);
const [frontendPort, backendPort] = ports[slug];
const route = `/projects/${slug}`;
const siteUrl = `https://lumixengine.com${route}`;
const sharedEnv = {
  NODE_ENV: "production",
  BIND_HOST: "127.0.0.1",
  NEXT_PUBLIC_BASE_PATH: route,
  NEXT_BASE_PATH: route,
  NEXT_PUBLIC_CINEMA_SLUG: slug,
  NEXT_PUBLIC_SITE_URL: siteUrl,
  NEXT_PUBLIC_CINE_API_URL: siteUrl,
  CINE_BACKEND_URL: `http://127.0.0.1:${backendPort}`,
  CINE_UPLOADS_DIR: `${baseDir}/shared/uploads`,
};

module.exports = {
  apps: [
    {
      name: `${slug}-backend`,
      cwd: `${baseDir}/current`,
      script: "backend/server.js",
      interpreter: "node",
      env: {
        ...sharedEnv,
        PORT: String(backendPort),
        EMAIL_AUTOMATION_TOKEN: process.env.EMAIL_AUTOMATION_TOKEN,
        EMAIL_AUTOMATION_MODE: process.env.EMAIL_AUTOMATION_MODE || "draft",
      },
    },
    {
      name: `${slug}-frontend`,
      cwd: `${baseDir}/current`,
      script: "npm",
      args: "start -- -H 127.0.0.1",
      env: { ...sharedEnv, PORT: String(frontendPort) },
    },
  ],
};
