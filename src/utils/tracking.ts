export type TrackingEvent =
  | "view_content"
  | "begin_checkout"
  | "add_to_cart"
  | "add_payment_info"
  | "purchase"
  | "lead"
  | "subscribe"
  | "sign_up"
  | "login"
  | "email_verification_requested"
  | "email_verified";

type TrackingValue = string | number | boolean | null | undefined | TrackingValue[] | { [key: string]: TrackingValue };

const CONSENT_KEY = "cine-cruzeiro-measurement-consent";

export function measurementConsentGranted() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) === "granted";
}

const forbiddenKey = /(^|_)(email|e_mail|name|nome|phone|telefone|whatsapp|cpf|document|address|endereco|password|senha)($|_)/i;

function sanitizeTrackingValue(value: TrackingValue, key = ""): TrackingValue {
  if (forbiddenKey.test(key)) return undefined;
  if (typeof value === "string" && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) return undefined;
  if (Array.isArray(value)) return value.map((item) => sanitizeTrackingValue(item)).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, sanitizeTrackingValue(nestedValue, nestedKey)]).filter(([, nestedValue]) => nestedValue !== undefined)
    );
  }
  return value;
}

export function trackMarketingEvent(event: TrackingEvent, parameters: Record<string, TrackingValue> = {}) {
  if (typeof window === "undefined" || !measurementConsentGranted()) return;
  const clean = Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => [key, sanitizeTrackingValue(value, key)]).filter(([, value]) => value !== undefined)
  );
  const trackedWindow = window as typeof window & {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  const googleEvent = event === "lead" ? "generate_lead" : event === "view_content" ? "view_item" : event;
  trackedWindow.gtag?.("event", googleEvent, clean);
  const metaEvents: Partial<Record<TrackingEvent, string>> = {
    view_content: "ViewContent",
    begin_checkout: "InitiateCheckout",
    add_to_cart: "AddToCart",
    add_payment_info: "AddPaymentInfo",
    purchase: "Purchase",
    lead: "Lead",
    subscribe: "Subscribe",
    sign_up: "CompleteRegistration",
    login: "Login",
    email_verified: "CompleteRegistration",
  };
  const metaEvent = metaEvents[event];
  if (!metaEvent) {
    trackedWindow.fbq?.("trackCustom", event, clean);
    return;
  }
  const items = Array.isArray(clean.items) ? clean.items as Array<Record<string, TrackingValue>> : [];
  const metaParameters = {
    ...clean,
    content_type: items.length ? "product" : undefined,
    content_ids: items.map((item) => item.item_id).filter(Boolean),
    contents: items.map((item) => ({ id: item.item_id, quantity: item.quantity, item_price: item.price })),
  };
  delete metaParameters.items;
  trackedWindow.fbq?.("track", metaEvent, metaParameters);
}

export const measurementConsentKey = CONSENT_KEY;
