const baseDir = "/home/ubuntu/projects/cine-estacao-amparo";
const route = "/projects/cine-estacao-amparo";
const siteUrl = `https://lumixengine.com${route}`;
const sharedEnv = {
  NODE_ENV: "production",
  BIND_HOST: "127.0.0.1",
  NEXT_PUBLIC_BASE_PATH: route,
  NEXT_BASE_PATH: route,
  NEXT_PUBLIC_CINEMA_SLUG: "cine-estacao-amparo",
  NEXT_PUBLIC_SITE_URL: siteUrl,
  NEXT_PUBLIC_CINE_API_URL: siteUrl,
  CINE_BACKEND_URL: "http://127.0.0.1:4120",
  CINE_UPLOADS_DIR: `${baseDir}/shared/uploads`,
};

module.exports = {
  apps: [
    {
      name: "cine-estacao-amparo-backend",
      cwd: `${baseDir}/current`,
      script: "backend/server.js",
      interpreter: "node",
      env: {
        ...sharedEnv,
        PORT: "4120",
        STUDIO_AUTOMATION_TOKEN: process.env.STUDIO_AUTOMATION_TOKEN,
        EMAIL_AUTOMATION_TOKEN: process.env.EMAIL_AUTOMATION_TOKEN,
        EMAIL_AUTOMATION_MODE: process.env.EMAIL_AUTOMATION_MODE || "draft",
      },
    },
    {
      name: "cine-estacao-amparo-frontend",
      cwd: `${baseDir}/current`,
      script: "npm",
      args: "start -- -H 127.0.0.1",
      env: { ...sharedEnv, PORT: "3120" },
    },
  ],
};
