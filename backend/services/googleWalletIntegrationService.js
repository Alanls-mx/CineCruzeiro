function createGoogleWalletIntegrationService({
  getGoogleWalletConfig, appFrontendUrl,
  buildGoogleWalletClassIdentityForCinema, buildGoogleWalletClassTemplateInfo,
  signWalletJwt, logEvent, fetch
}) {
function googleWalletApiError(error, fallback = "Google Wallet recusou a requisicao.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error.error_description) return error.error_description;
  if (typeof error.error === "string") return error.error;
  if (error.error && typeof error.error === "object") {
    const apiError = error.error;
    const details = Array.isArray(apiError.errors) && apiError.errors[0] ? apiError.errors[0] : {};
    return [apiError.status || details.reason || "", apiError.message || details.message || fallback].filter(Boolean).join(": ");
  }
  return error.message || fallback;
}

async function googleWalletAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signWalletJwt({
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }, config.privateKey);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payload = await response.json().catch(() => ({}));
  const token = payload.access_token;
  if (!response.ok || !token) {
    const error = new Error(googleWalletApiError(payload, "Falha ao autenticar a Service Account."));
    error.statusCode = response.status;
    throw error;
  }
  return token;
}

async function googleWalletApiRequest(pathname, config, options = {}) {
  const token = await googleWalletAccessToken(config);
  const response = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1${pathname}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(googleWalletApiError(payload));
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function googleWalletApiGet(pathname, config) {
  return googleWalletApiRequest(pathname, config);
}

async function googleWalletApiPatch(pathname, config, body) {
  return googleWalletApiRequest(pathname, config, { method: "PATCH", body });
}

async function testGoogleWalletIntegration(db) {
  const wallet = getGoogleWalletConfig(db);
  const configuredCinemaName = String(db?.settings?.cinemaName || db?.settings?.name || "").trim();
  const desiredIdentity = buildGoogleWalletClassIdentityForCinema(db?.settings, appFrontendUrl());
  const checks = [
    { key: "cinemaBrand", label: "Cinema", ok: Boolean(configuredCinemaName), detail: configuredCinemaName || "Nome do cinema ausente. Configure a identidade antes de testar o Google Wallet." },
    { key: "serviceAccount", label: "Service Account", ok: Boolean(wallet.clientEmail && wallet.privateKey), detail: wallet.clientEmail ? `Configurada como ${wallet.clientEmail}` : "JSON da Service Account ausente." },
    { key: "issuer", label: "Issuer", ok: Boolean(wallet.issuerId), detail: wallet.issuerId || "Issuer ID ausente." },
    { key: "class", label: "Classe configurada", ok: Boolean(wallet.configuredClassId), detail: wallet.configuredClassId || "Class ID ausente." },
    { key: "origin", label: "Origem", ok: wallet.origins.length > 0, detail: wallet.origins.join(", ") || "Origem ausente." }
  ];
  if (checks.some((item) => !item.ok)) {
    return {
      ok: false,
      message: checks.find((item) => !item.ok)?.detail || "Configuração incompleta.",
      checks,
      diagnostics: {
        issuerId: wallet.issuerId,
        classId: wallet.classId,
        clientEmail: wallet.clientEmail,
        origins: wallet.origins,
        passType: "EventTicket"
      }
    };
  }

  try {
    let eventClass = null;
    let resolvedClassId = wallet.classId;

    try {
      eventClass = await googleWalletApiGet(`/eventTicketClass/${encodeURIComponent(wallet.classId)}`, wallet);
      resolvedClassId = eventClass.id || wallet.classId;
    } catch (err) {
      if (err.statusCode === 404) {
        const classSuffix = wallet.classId.includes(".") ? wallet.classId.split(".").slice(1).join(".") : wallet.classId;
        const listData = await googleWalletApiGet(`/eventTicketClass?issuerId=${encodeURIComponent(wallet.issuerId)}`, wallet).catch(() => null);
        const matching = (listData?.resources || []).find((item) => (
          item.id === wallet.classId || item.id === `${wallet.issuerId}.${classSuffix}` || item.id.endsWith(`.${classSuffix}`)
        ));
        if (matching) {
          eventClass = matching;
          resolvedClassId = matching.id;
        } else if (process.env.NEXT_PUBLIC_CINEMA_SLUG === "cinecruzeiro"
          && wallet.classId === `${wallet.issuerId}.cine_cruzeiro_ingressos`) {
          eventClass = await googleWalletApiRequest("/eventTicketClass", wallet, {
            method: "POST",
            body: {
              id: wallet.classId,
              ...desiredIdentity,
              classTemplateInfo: buildGoogleWalletClassTemplateInfo(),
              reviewStatus: "UNDER_REVIEW"
            }
          });
          resolvedClassId = eventClass.id || wallet.classId;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    wallet.classId = resolvedClassId;
    if (db) {
      if (db.integrations?.googleWallet) db.integrations.googleWallet.resolvedClassId = resolvedClassId;
      if (db.settings?.integrations?.googleWallet) db.settings.integrations.googleWallet.resolvedClassId = resolvedClassId;
    }

    const issuerFromClass = String(eventClass.id || "").split(".")[0] || "";
    const classBelongsToIssuer = issuerFromClass === wallet.issuerId || String(eventClass.id || "").startsWith(`${wallet.issuerId}.`);
    let reviewStatus = String(eventClass.reviewStatus || "").toUpperCase();
    const classRejected = reviewStatus === "REJECTED";
    const desiredTemplate = buildGoogleWalletClassTemplateInfo();
    const currentTemplate = eventClass.classTemplateInfo || {};
    const templateChanged = JSON.stringify({
      cardTemplateOverride: currentTemplate.cardTemplateOverride,
      detailsTemplateOverride: currentTemplate.detailsTemplateOverride
    }) !== JSON.stringify(desiredTemplate);
    const identityChanged = String(eventClass.eventName?.defaultValue?.value || "") !== desiredIdentity.eventName.defaultValue.value
      || String(eventClass.issuerName || "") !== desiredIdentity.issuerName
      || String(eventClass.logo?.sourceUri?.uri || "") !== desiredIdentity.logo.sourceUri.uri;
    const classPresentationChanged = templateChanged || identityChanged;
    if (classPresentationChanged && !classRejected && classBelongsToIssuer) {
      eventClass = await googleWalletApiPatch(
        `/eventTicketClass/${encodeURIComponent(resolvedClassId)}`,
        wallet,
        {
          classTemplateInfo: desiredTemplate,
          ...desiredIdentity,
          reviewStatus: "UNDER_REVIEW"
        }
      );
      reviewStatus = String(eventClass.reviewStatus || "UNDER_REVIEW").toUpperCase();
    }
    checks.push(
      { key: "auth", label: "Autenticação", ok: true, detail: "Service Account autenticada na API Google Wallet." },
      { key: "classRead", label: "EventTicketClass", ok: true, detail: `${eventClass.id || wallet.classId} encontrada.` },
      { key: "classLayout", label: "Layout do ingresso", ok: !classRejected && classBelongsToIssuer, detail: classRejected ? "A classe rejeitada não pode receber o layout de produção." : !classBelongsToIssuer ? "O layout não foi alterado porque a classe pertence a outro Issuer." : classPresentationChanged ? "Layout do cinema enviado para revisão da classe." : "Layout do cinema já estava atualizado." },
      { key: "classIssuer", label: "Classe do Issuer", ok: classBelongsToIssuer, detail: classBelongsToIssuer ? "Class ID pertence ao Issuer configurado." : `Classe pertence ao Issuer ${issuerFromClass || "desconhecido"}.` },
      {
        key: "classStatus",
        label: "Status da classe",
        ok: !classRejected,
        level: reviewStatus === "APPROVED" ? "ok" : classRejected ? "error" : "warning",
        detail: reviewStatus === "APPROVED"
          ? "Classe aprovada para publicação."
          : classRejected
            ? "Classe rejeitada pelo Google. Revise-a no Google Pay & Wallet Console."
            : `${eventClass.reviewStatus || "Status não informado"}. A conexão funciona, mas a publicação pode ficar restrita a usuários de teste.`
      },
      { key: "jwt", label: "Geração JWT", ok: true, detail: "Assinatura RS256 pronta para Save to Google Wallet." },
      { key: "publication", label: "Publicação", ok: true, detail: String(wallet.environment || "production") === "sandbox" ? "Modo de demonstração/teste." : "Produção configurada." }
    );
    const ok = checks.every((item) => item.ok);
    logEvent("info", "google_wallet.integration.tested", {
      ok,
      issuerId: wallet.issuerId,
      classId: wallet.classId,
      clientEmail: wallet.clientEmail,
      origins: wallet.origins,
      passType: "EventTicket",
      reviewStatus: eventClass.reviewStatus || ""
    });
    return {
      ok,
      resolvedClassId,
      message: ok
        ? reviewStatus === "APPROVED"
          ? "Google Wallet autenticado, Issuer encontrado e EventTicketClass pronta."
          : "Google Wallet autenticado e EventTicketClass encontrada. A classe ainda não está aprovada para publicação geral."
        : checks.find((item) => !item.ok)?.detail || "Revise a configuração do Google Wallet.",
      checks,
      diagnostics: {
        issuerId: wallet.issuerId,
        classId: wallet.classId,
        clientEmail: wallet.clientEmail,
        origins: wallet.origins,
        passType: "EventTicket",
        reviewStatus: eventClass.reviewStatus || "",
        demoModeNotice: "Se o Issuer estiver em modo de demonstração, apenas usuários de teste conseguem adicionar o ingresso."
      }
    };
  } catch (error) {
    const isServiceDisabled = /has not been used in project|disabled|SERVICE_DISABLED/i.test(error.message || "");
    const failureMessage = isServiceDisabled
      ? (error.message || "A Google Wallet API está desativada no projeto do Google Cloud. Ative-a no Google Cloud Console.")
      : error.statusCode === 403
        ? `A Service Account ${wallet.clientEmail} não possui acesso ao Issuer ${wallet.issuerId}. Adicione esse e-mail como usuário no Google Pay & Wallet Console.`
        : error.statusCode === 404
          ? `A classe ${wallet.classId} não foi encontrada. Confirme o Issuer ID e o Class ID cadastrados no Google Pay & Wallet Console.`
          : error.message || "Falha ao testar Google Wallet.";

    checks.push({ key: "api", label: "API Google Wallet", ok: false, detail: error.message || "Falha ao consultar a classe." });
    logEvent("warn", "google_wallet.integration_failed", {
      issuerId: wallet.issuerId,
      classId: wallet.classId,
      clientEmail: wallet.clientEmail,
      origins: wallet.origins,
      passType: "EventTicket",
      statusCode: error.statusCode || 0,
      message: error.message
    });
    return {
      ok: false,
      message: failureMessage,
      checks,
      diagnostics: {
        issuerId: wallet.issuerId,
        classId: wallet.classId,
        clientEmail: wallet.clientEmail,
        origins: wallet.origins,
        passType: "EventTicket",
        statusCode: error.statusCode || 0,
        apiErrorDetail: error.message || ""
      }
    };
  }
}

  return { googleWalletApiRequest, googleWalletApiGet, googleWalletApiPatch,
    testGoogleWalletIntegration };
}

module.exports = { createGoogleWalletIntegrationService };
