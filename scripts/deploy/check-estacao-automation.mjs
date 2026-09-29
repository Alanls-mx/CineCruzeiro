#!/usr/bin/env node

const base = "http://127.0.0.1:4120";
const checks = [
  ["studio", "/api/studio/context", process.env.STUDIO_AUTOMATION_TOKEN],
  ["email", "/api/email-automation/context", process.env.EMAIL_AUTOMATION_TOKEN],
];

for (const [name, route, token] of checks) {
  if (!token) throw new Error(`${name}: token ausente`);
  const response = await fetch(`${base}${route}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  console.log(`${name}: ${response.status}`);
  if (response.ok && name === "studio") {
    const body = await response.json();
    console.log(`marca: ${body.cinema?.name || "(ausente)"}`);
    console.log(`assinatura: ${body.cinema?.posterLogoUrl || "(ausente)"}`);
  }
  if (!response.ok) process.exitCode = 1;
}

if (process.argv[2]) {
  const response = await fetch(`${base}/api/studio/campaigns/${process.argv[2]}`, {
    headers: { Authorization: `Bearer ${process.env.STUDIO_AUTOMATION_TOKEN}` },
  });
  const body = await response.json();
  console.log(`poster: ${body.campaign?.status || response.status}`);
  console.log(`tipo de assinatura: ${body.campaign?.result?.compositions?.[0]?.draft?.signatureId || "(ausente)"}`);
}
