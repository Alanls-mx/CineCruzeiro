const crypto = require("crypto");

const DAY_MS = 86400000;
const TYPES = new Set(["weekly", "premiere", "birthday", "reactivation"]);

const COPY = Object.freeze({
  weekly: [
    { subject: "A programação da semana chegou", headline: "Escolha sua próxima história", preheader: "Filmes e horários confirmados no Cine Cruzeiro.", message: "Olá, {{nome}}. Reunimos os filmes e horários confirmados para você planejar sua próxima sessão.", ctaLabel: "Ver programação completa" },
    { subject: "Sua próxima sessão começa aqui", headline: "Uma semana de grandes histórias", preheader: "Confira o que está em cartaz e escolha seu horário.", message: "Olá, {{nome}}. A tela grande está pronta: compare os horários e encontre a sessão que combina com a sua semana.", ctaLabel: "Escolher uma sessão" },
    { subject: "O que assistir no Cine Cruzeiro esta semana", headline: "Tem cinema para todos os momentos", preheader: "Veja os destaques e horários disponíveis.", message: "Olá, {{nome}}. Estes são os títulos da programação e as sessões disponíveis para os próximos dias.", ctaLabel: "Explorar os filmes" }
  ],
  premiere: [
    { subject: "Uma nova estreia chega à tela grande", headline: "A próxima grande história começa aqui", preheader: "Confira a estreia e escolha sua sessão.", message: "Olá, {{nome}}. Uma nova história acaba de chegar ao Cine Cruzeiro. Veja os horários confirmados e garanta seu lugar.", ctaLabel: "Ver sessões" },
    { subject: "Estreia no Cine Cruzeiro", headline: "Viva esta estreia como ela merece", preheader: "Pôster, horários e ingressos em um só lugar.", message: "Olá, {{nome}}. Chegou a hora de viver esta estreia na tela grande, com som, imagem e emoção de cinema.", ctaLabel: "Escolher meu horário" }
  ],
  birthday: [
    { subject: "Feliz aniversário, {{nome}}!", headline: "Hoje a história principal é a sua", preheader: "O Cine Cruzeiro deseja um novo ciclo cheio de boas histórias.", message: "Parabéns, {{nome}}! Que seu novo ciclo tenha encontros, emoção e muitas histórias inesquecíveis.", ctaLabel: "Escolher um filme" },
    { subject: "Uma sessão especial para celebrar você", headline: "Seu novo ciclo merece cinema", preheader: "Celebre seu dia com uma boa história na tela grande.", message: "Olá, {{nome}}. O Cine Cruzeiro deseja um aniversário cheio de bons momentos e histórias para guardar.", ctaLabel: "Ver programação" }
  ],
  reactivation: [
    { subject: "Tem uma nova história esperando por você", headline: "Que tal voltar à tela grande?", preheader: "Conheça os filmes e horários atuais do Cine Cruzeiro.", message: "Olá, {{nome}}. A programação mudou desde sua última visita. Venha descobrir as histórias que estão em cartaz agora.", ctaLabel: "Descobrir a programação" },
    { subject: "Sentimos sua falta no Cine Cruzeiro", headline: "Novas histórias chegaram à nossa tela", preheader: "Confira a programação e encontre sua próxima sessão.", message: "Olá, {{nome}}. Quando quiser voltar, a tela grande estará pronta. Veja os filmes e horários disponíveis.", ctaLabel: "Ver o que está em cartaz" }
  ]
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function sessionDate(session = {}) {
  return String(session.date || session.sessionDate || "").slice(0, 10);
}

function visibleMovies(db = {}) {
  return (db.movies || []).filter((movie) => movie.active !== false && movie.status !== "hidden" && movie.workflowStatus !== "draft" && movie.workflowStatus !== "archived");
}

function moviesInWindow(db, start, days = 7) {
  const first = dateKey(start);
  const last = dateKey(new Date(new Date(start).getTime() + Math.max(1, days) * DAY_MS));
  return visibleMovies(db).filter((movie) => (movie.sessions || []).some((session) => {
    const date = sessionDate(session);
    return date && date >= first && date < last && !["cancelled", "hidden"].includes(String(session.status || ""));
  }));
}

function birthdayCustomerIds(db, now) {
  const today = dateKey(now).slice(5);
  return (db.users || []).filter((user) => {
    const birthDate = user.birthDate || user.dateOfBirth || user.birthday || user.profile?.birthDate || "";
    return user.role === "customer" && user.active !== false && String(birthDate).slice(5, 10) === today;
  }).map((user) => String(user.id));
}

function chooseCopy(type, history = []) {
  const options = COPY[type] || COPY.weekly;
  const recent = new Set((history || []).slice(0, 20).flatMap((campaign) => [campaign.subject, campaign.headline]).filter(Boolean));
  return options.find((option) => !recent.has(option.subject) && !recent.has(option.headline)) || options[(history || []).length % options.length];
}

function absoluteUrl(value, siteUrl) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try { return new URL(raw, `${String(siteUrl || "").replace(/\/$/, "")}/`).href; } catch { return ""; }
}

function movieSessions(movie, start, days = 7) {
  const first = dateKey(start);
  const last = dateKey(new Date(new Date(start).getTime() + Math.max(1, days) * DAY_MS));
  return (movie.sessions || []).filter((session) => {
    const date = sessionDate(session);
    return date && date >= first && date < last && !["cancelled", "hidden"].includes(String(session.status || ""));
  }).sort((left, right) => `${sessionDate(left)} ${left.time || ""}`.localeCompare(`${sessionDate(right)} ${right.time || ""}`));
}

function formatSession(session) {
  const date = sessionDate(session);
  const [, month, day] = date.split("-");
  return `${day || ""}/${month || ""} · ${String(session.time || "").slice(0, 5)}`;
}

function campaignHtml({ type, copy, movies, siteUrl }) {
  const accent = type === "birthday" ? "#f6c453" : type === "reactivation" ? "#4d8dff" : "#22d3ee";
  const cards = movies.slice(0, 6).map((movie) => {
    const poster = absoluteUrl(movie.posterUrl || movie.backdropUrl, siteUrl);
    const sessions = movieSessions(movie, new Date(), type === "premiere" ? 21 : 7).slice(0, 5).map(formatSession).join(" &nbsp; ");
    return `<tr><td style="padding:14px 0;border-top:1px solid #26384d"><table role="presentation" width="100%"><tr>${poster ? `<td width="92" valign="top"><img src="${escapeHtml(poster)}" width="76" alt="Pôster de ${escapeHtml(movie.title)}" style="display:block;width:76px;height:108px;object-fit:cover;border-radius:4px"></td>` : ""}<td valign="top"><strong style="display:block;color:#ffffff;font-size:18px;line-height:1.3">${escapeHtml(movie.title || "Filme")}</strong>${sessions ? `<span style="display:block;margin-top:8px;color:#cbd5e1;font-size:13px;line-height:1.55">${escapeHtml(sessions)}</span>` : ""}</td></tr></table></td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07111d;color:#dbeafe;font-family:Arial,sans-serif"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" style="max-width:620px;background:#0b1728;border-top:4px solid ${accent};border-radius:8px"><tr><td style="padding:30px"><p style="margin:0 0 12px;color:${accent};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Cine Cruzeiro</p><h1 style="margin:0;color:#fff;font-size:30px;line-height:1.15">${escapeHtml(copy.headline)}</h1><p style="margin:18px 0 0;color:#dbeafe;font-size:16px;line-height:1.65">${escapeHtml(copy.message)}</p>${cards ? `<table role="presentation" width="100%" style="margin-top:24px">${cards}</table>` : ""}<p style="margin:28px 0 0"><a href="${escapeHtml(absoluteUrl("/filmes", siteUrl))}" style="display:inline-block;padding:14px 20px;background:${accent};color:#050912;text-decoration:none;font-weight:800;border-radius:5px">${escapeHtml(copy.ctaLabel)}</a></p></td></tr></table></td></tr></table>`;
}

function buildEmailAutomationPlan(db = {}, request = {}, options = {}) {
  const type = TYPES.has(String(request.type || request.scenario || "")) ? String(request.type || request.scenario) : "weekly";
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const history = options.history || [];
  const siteUrl = options.siteUrl || "https://www.cinecruzeiro.com.br";
  let movies = [];
  let customerIds = [];
  const warnings = [];
  if (type === "weekly" || type === "reactivation") movies = moviesInWindow(db, now, 7);
  if (type === "premiere") {
    const requested = visibleMovies(db).find((movie) => String(movie.id) === String(request.movieId || ""));
    const earliestRelease = dateKey(new Date(now.getTime() - 3 * DAY_MS));
    const latestRelease = dateKey(new Date(now.getTime() + 21 * DAY_MS));
    movies = requested ? [requested] : moviesInWindow(db, now, 21).filter((movie) => {
      const status = String(movie.status || "").toLowerCase();
      const releaseDate = String(movie.releaseDate || movie.release_date || "").slice(0, 10);
      return ["upcoming", "coming_soon", "em_breve"].includes(status) || (releaseDate && releaseDate >= earliestRelease && releaseDate <= latestRelease);
    }).slice(0, 1);
  }
  if (type === "birthday") customerIds = birthdayCustomerIds(db, now);
  if (["weekly", "premiere", "reactivation"].includes(type) && !movies.length) return { skipped: true, type, reason: "Nenhum filme com sessão confirmada foi encontrado para este período." };
  if (type === "birthday" && !customerIds.length) return { skipped: true, type, reason: "Não há clientes aniversariantes com cadastro ativo hoje." };
  if (movies.some((movie) => !movie.posterUrl && !movie.backdropUrl)) warnings.push("Há filme sem pôster ou backdrop; o e-mail usará composição tipográfica para esse item.");
  const copy = chooseCopy(type, history);
  const period = type === "weekly" ? `${dateKey(now)}:${dateKey(new Date(now.getTime() + 7 * DAY_MS))}` : dateKey(now);
  const templateId = type === "weekly" ? "weekly" : type === "premiere" ? "premiere" : type;
  const recipientMode = type === "birthday" ? "birthday_manual" : type === "reactivation" ? "reactivation" : "all";
  const movieIds = movies.map((movie) => String(movie.id));
  const identityPeriod = type === "premiere" ? "movie-lifecycle" : period;
  const fingerprint = crypto.createHash("sha256").update(`${type}:${identityPeriod}:${movieIds.join(",")}:${customerIds.join(",")}`).digest("hex").slice(0, 20);
  return {
    skipped: false,
    type,
    warnings,
    signals: { movieCount: movieIds.length, customerCount: customerIds.length, period, copyRotated: history.length > 0 },
    campaign: {
      idempotencyKey: `email-auto:${type}:${fingerprint}`,
      mode: "template",
      templateId,
      objective: ["weekly", "premiere"].includes(type) ? (type === "weekly" ? "programming" : "movie") : "announcement",
      templateSelectionMode: "automatic",
      subject: copy.subject,
      preheader: copy.preheader,
      headline: copy.headline,
      message: copy.message,
      html: campaignHtml({ type, copy, movies, siteUrl }),
      ctaLabel: copy.ctaLabel,
      ctaUrl: `${String(siteUrl).replace(/\/$/, "")}/filmes`,
      recipientMode,
      reactivationDays: Math.max(30, Math.min(365, Number(request.reactivationDays || 90))),
      customerIds,
      movieId: type === "premiere" ? movieIds[0] || "" : "",
      movieIds,
      imageUrl: movies[0]?.posterUrl || movies[0]?.backdropUrl || "",
      imageAlt: movies[0]?.title || "Programação do Cine Cruzeiro",
      variables: { automation_type: type, automation_period: period },
      visualStyleLabel: `Automação n8n · ${type}`,
      createdBy: "n8n"
    }
  };
}

function emailAutomationContext(db = {}, options = {}) {
  const now = options.now || new Date();
  return {
    generatedAt: new Date(now).toISOString(),
    timezone: "America/Sao_Paulo",
    activeMovies: visibleMovies(db).length,
    weeklyMovies: moviesInWindow(db, now, 7).length,
    birthdayCustomers: birthdayCustomerIds(db, now).length,
    supportedTypes: [...TYPES]
  };
}

module.exports = { buildEmailAutomationPlan, emailAutomationContext, _test: { birthdayCustomerIds, chooseCopy, moviesInWindow, campaignHtml, dateKey } };
