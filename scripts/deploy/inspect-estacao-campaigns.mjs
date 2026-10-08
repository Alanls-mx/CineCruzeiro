#!/usr/bin/env node

const ids = process.argv.slice(2);
const token = process.env.STUDIO_AUTOMATION_TOKEN;
if (!token || !ids.length) throw new Error("Informe o token no ambiente e os IDs das campanhas.");

if (ids.includes("context")) {
  const response = await fetch("http://127.0.0.1:4120/api/studio/context", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  console.log(JSON.stringify({ movies: body.movies?.map(({ id, title, sessions }) => ({ id, title, sessions })) }, null, 2));
}

for (const id of ids.filter((value) => value !== "context")) {
  const response = await fetch(`http://127.0.0.1:4120/api/studio/campaigns/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const { campaign } = await response.json();
  console.log(JSON.stringify({
    id,
    status: campaign?.status || response.status,
    subject: campaign?.request?.subject,
    error: campaign?.error,
    qa: campaign?.qa,
    compositions: campaign?.result?.compositions?.map(({ draft, quality }) => ({
      templateId: draft?.templateId,
      movieIds: draft?.movieIds,
      programMovies: draft?.programMovies?.map(({ title, schedule }) => ({ title, days: schedule?.days })),
      quality,
    })),
  }, null, 2));
}
