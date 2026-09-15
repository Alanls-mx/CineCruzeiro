#!/usr/bin/env node

import process from "node:process";
import { loadRegistry } from "./cinema-instance-registry.mjs";

function proxyHeaders(route, timeout = "60s") {
  return `        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix ${route};
        proxy_read_timeout ${timeout};`;
}

function render(instance) {
  const { route, frontendPort, backendPort, slug } = instance;
  const escaped = route.replaceAll("/", "\\/");
  const frontend = `http://127.0.0.1:${frontendPort}`;
  const backend = `http://127.0.0.1:${backendPort}`;
  return `    # BEGIN managed cinema demo: ${slug}
    location = ${route} {
        proxy_pass ${frontend};
${proxyHeaders(route)}
    }

    location ^~ ${route}/api/ {
        rewrite ^${escaped}/api/(.*)$ /api/$1 break;
        proxy_pass ${backend};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix ${route};
        proxy_read_timeout 300s;
        client_max_body_size 20m;
    }

    location = ${route}/admin {
        proxy_hide_header Permissions-Policy;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header X-Content-Type-Options;
        proxy_hide_header Referrer-Policy;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=()" always;
        rewrite ^ /admin break;
        proxy_pass ${backend};
${proxyHeaders(route)}
        client_max_body_size 20m;
    }

    location ^~ ${route}/admin/ {
        proxy_hide_header Permissions-Policy;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header X-Content-Type-Options;
        proxy_hide_header Referrer-Policy;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=()" always;
        rewrite ^${escaped}/admin/(.*)$ /admin/$1 break;
        proxy_pass ${backend};
${proxyHeaders(route)}
        client_max_body_size 20m;
    }

    location ^~ ${route}/uploads/ {
        rewrite ^${escaped}/uploads/(.*)$ /uploads/$1 break;
        proxy_pass ${backend};
${proxyHeaders(route)}
    }

    location ^~ ${route}/images/ {
        rewrite ^${escaped}/images/(.*)$ /images/$1 break;
        proxy_pass ${backend};
${proxyHeaders(route)}
    }

    location ^~ ${route}/trailers/ {
        rewrite ^${escaped}/trailers/(.*)$ /trailers/$1 break;
        proxy_pass ${backend};
${proxyHeaders(route)}
    }

    location ^~ ${route}/ {
        proxy_pass ${frontend};
${proxyHeaders(route)}
    }
    # END managed cinema demo: ${slug}`;
}

function main() {
  const [registryPath, ...slugs] = process.argv.slice(2);
  if (!registryPath || !slugs.length) {
    throw new Error("Uso: node scripts/render-demo-nginx.mjs <registro.json> <slug> [slug...]");
  }
  const registry = loadRegistry(registryPath);
  const selected = slugs.map((slug) => {
    const instance = registry.instances.find((entry) => entry.slug === slug);
    if (!instance) throw new Error(`Instalacao nao encontrada: ${slug}`);
    if (instance.slug === "cinecruzeiro") throw new Error("A rota existente do Cine Cruzeiro nao deve ser gerada neste snippet.");
    return instance;
  });
  console.log(selected.map(render).join("\n\n"));
}

try {
  main();
} catch (error) {
  console.error(`NGINX_RENDER_ERROR: ${error.message}`);
  process.exit(1);
}
