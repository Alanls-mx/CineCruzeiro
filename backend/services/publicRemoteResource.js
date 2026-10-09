const dns = require("node:dns");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

function publicIpv4(address) {
  if (net.isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return a !== 0 && a !== 10 && a !== 127 && a < 224
    && !(a === 100 && b >= 64 && b <= 127)
    && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && (b === 0 || (b === 168) || (b === 0 && c === 2)))
    && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    && !(a === 203 && b === 0 && c === 113);
}

function parsePublicUrl(value, { httpsOnly = false, allowedHosts = null } = {}) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("URL remota inválida."); }
  if ((httpsOnly && url.protocol !== "https:") || (!httpsOnly && !["http:", "https:"].includes(url.protocol))) {
    throw new Error("Protocolo remoto não permitido.");
  }
  if (url.username || url.password || url.port || net.isIP(url.hostname)
      || !url.hostname.includes(".") || /\.(?:local|internal|localhost|test|invalid)$/i.test(url.hostname)) {
    throw new Error("Destino remoto não permitido.");
  }
  if (allowedHosts && !allowedHosts.has(url.hostname)) throw new Error("Destino remoto não autorizado.");
  return url;
}

function publicLookup(hostname, _options, callback) {
  dns.lookup(hostname, { family: 4, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const address = addresses.find((item) => publicIpv4(item.address));
    if (!address) return callback(new Error("Destino remoto não público."));
    callback(null, address.address, 4);
  });
}

function openPublicResource(value, options = {}) {
  const url = parsePublicUrl(value, options);
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.get(url, {
      lookup: publicLookup,
      timeout: options.timeoutMs || 9000,
      headers: options.headers || {}
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.destroy();
        reject(new Error(`Recurso remoto indisponível (HTTP ${response.statusCode}).`));
        return;
      }
      const declaredSize = Number(response.headers["content-length"] || 0);
      if (options.maxBytes && declaredSize > options.maxBytes) {
        response.destroy();
        reject(new Error("Recurso remoto excede o limite permitido."));
        return;
      }
      resolve(response);
    });
    request.on("timeout", () => request.destroy(new Error("Tempo esgotado ao obter recurso remoto.")));
    request.on("error", reject);
  });
}

async function downloadPublicBuffer(value, options = {}) {
  const response = await openPublicResource(value, options);
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response) {
      size += chunk.length;
      if (size > options.maxBytes) throw new Error("Recurso remoto excede o limite permitido.");
      chunks.push(Buffer.from(chunk));
    }
    return { buffer: Buffer.concat(chunks), contentType: String(response.headers["content-type"] || "") };
  } catch (error) {
    response.destroy();
    throw error;
  }
}

module.exports = { publicIpv4, parsePublicUrl, openPublicResource, downloadPublicBuffer };
