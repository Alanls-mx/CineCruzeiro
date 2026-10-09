const net = require("net");

const LOOPBACK_ADDRESSES = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1"]);

function clientIp(req) {
  const remoteAddress = String(req.socket.remoteAddress || "local").trim();
  if (!LOOPBACK_ADDRESSES.has(remoteAddress)) return remoteAddress;

  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").at(-1)?.trim();
  if (forwarded && net.isIP(forwarded)) return forwarded;

  const realIp = String(req.headers["x-real-ip"] || "").trim();
  return net.isIP(realIp) ? realIp : remoteAddress;
}

module.exports = { clientIp };
