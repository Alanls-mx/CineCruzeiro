let securityScriptPromise: Promise<void> | null = null;

function deviceId() {
  const id = String((window as Window & { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID || "");
  return /^[A-Za-z0-9._:-]{8,256}$/.test(id) ? id : "";
}

async function waitForDeviceId(durationMs: number) {
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    const id = deviceId();
    if (id) return id;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return deviceId();
}

function loadSecurityScript() {
  if (!securityScriptPromise) {
    securityScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://www.mercadopago.com/v2/security.js";
      script.async = true;
      script.setAttribute("view", "checkout");
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Não foi possível carregar a verificação de segurança do Mercado Pago."));
      document.head.appendChild(script);
    });
  }
  return securityScriptPromise;
}

export async function ensureMercadoPagoDeviceId() {
  if (typeof window === "undefined") throw new Error("O pagamento precisa ser iniciado no navegador.");
  const existing = deviceId();
  if (existing) return existing;
  try {
    const { loadMercadoPago } = await import("@mercadopago/sdk-js");
    await loadMercadoPago();
  } catch {
    throw new Error("Não foi possível carregar a proteção do Mercado Pago. Recarregue a página e tente novamente.");
  }

  const fromSdk = await waitForDeviceId(1200);
  if (fromSdk) return fromSdk;
  await loadSecurityScript();
  const fromSecurityScript = await waitForDeviceId(5000);
  if (fromSecurityScript) return fromSecurityScript;
  throw new Error("A verificação de segurança do Mercado Pago não ficou pronta. Recarregue a página e tente novamente.");
}
