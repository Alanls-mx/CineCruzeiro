const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "desktop/windows/src/main.cpp"), "utf8");
const project = fs.readFileSync(path.join(root, "desktop/windows/CineCruzeiroDesktop.vcxproj"), "utf8");
const packages = fs.readFileSync(path.join(root, "desktop/windows/packages.config"), "utf8");

assert.match(main, /CreateCoreWebView2EnvironmentWithOptions/);
assert.match(main, /CINE_CRUZEIRO_ADMIN_URL/);
assert.match(main, /COREWEBVIEW2_PERMISSION_KIND_CAMERA/);
assert.match(main, /SameOrigin\(target, trustedOrigin_\)/);
assert.match(main, /HasCommandFlag\(L"reset-session"\)/);
assert.match(project, /Microsoft\.Web\.WebView2\.targets/);
assert.match(packages, /Microsoft\.Web\.WebView2/);

console.log("Desktop shell structure tests passed.");
