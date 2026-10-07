#!/usr/bin/env node

const base = "http://127.0.0.1:4120";
const checks = [
  ["email", "/api/email-automation/context", process.env.EMAIL_AUTOMATION_TOKEN],
];

for (const [name, route, token] of checks) {
  if (!token) throw new Error(`${name}: token ausente`);
  const response = await fetch(`${base}${route}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  console.log(`${name}: ${response.status}`);
  if (!response.ok) process.exitCode = 1;
}
