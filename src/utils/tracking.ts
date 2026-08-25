export type TrackingEvent = "view_content" | "begin_checkout" | "add_to_cart" | "purchase" | "lead" | "subscribe";

const CONSENT_KEY = "cine-cruzeiro-measurement-consent";

export function measurementConsentGranted() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) === "granted";
}

export function trackMarketingEvent(event: TrackingEvent, parameters: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === "undefined" || !measurementConsentGranted()) return;
  const clean = Object.fromEntries(Object.entries(parameters).filter(([, value]) => value !== undefined));
  const trackedWindow = window as typeof window & {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  };
  const googleEvent = event === "lead" ? "generate_lead" : event;
  trackedWindow.gtag?.("event", googleEvent, clean);
  const metaEvent = {
    view_content: "ViewContent",
    begin_checkout: "InitiateCheckout",
    add_to_cart: "AddToCart",
    purchase: "Purchase",
    lead: "Lead",
    subscribe: "Subscribe",
  }[event];
  trackedWindow.fbq?.("track", metaEvent, clean);
}

export const measurementConsentKey = CONSENT_KEY;
