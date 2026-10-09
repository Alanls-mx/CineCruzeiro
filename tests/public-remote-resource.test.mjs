import test from "node:test";
import assert from "node:assert/strict";
import service from "../backend/services/publicRemoteResource.js";

test("URLs locais, IPs privados e portas arbitrarias nao sao destinos de download", () => {
  for (const url of [
    "http://127.0.0.1/admin", "http://[::1]/", "http://10.0.0.1/", "http://169.254.169.254/metadata",
    "http://localhost/", "http://app.internal/", "https://example.com:8443/video.mp4",
    "file:///etc/passwd", "https://user:pass@example.com/"
  ]) assert.throws(() => service.parsePublicUrl(url));
  assert.equal(service.parsePublicUrl("https://image.tmdb.org/t/p/original/a.jpg").hostname, "image.tmdb.org");
});

test("DNS publico nao aceita faixas privadas ou reservadas", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.16.0.1", "192.168.1.2", "100.64.1.1", "198.18.0.1", "::1"]) {
    assert.equal(service.publicIpv4(address), false, address);
  }
  assert.equal(service.publicIpv4("8.8.8.8"), true);
});
