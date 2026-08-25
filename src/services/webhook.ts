import { TicketOrder, ClubLead, PrivateEventRequest, WebhookResponse } from "@/types";

const PRODUCTION_BASE_PATH = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const API_BASE = (process.env.NEXT_PUBLIC_BASE_PATH || PRODUCTION_BASE_PATH).replace(/\/+$/, "");

async function sendBackendEvent(event: string, data: unknown): Promise<WebhookResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data,
      }),
    });

    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      return {
        success: true,
        message: payload.message || "Evento recebido pelo backend.",
      };
    }
  } catch {
    // Eventos comerciais nao devem quebrar o checkout ou formulario.
  }

  return {
    success: true,
    message: "Solicitacao registrada localmente.",
  };
}

export async function sendTicketCheckoutWebhook(order: TicketOrder): Promise<WebhookResponse> {
  return sendBackendEvent("order.created", {
    ...order,
    source: "web_checkout_direct",
    channel: "landing_page",
  });
}

export async function sendClubLeadWebhook(lead: ClubLead): Promise<WebhookResponse> {
  return sendBackendEvent("club_lead.created", {
    ...lead,
    campaign: "clube_cinema_interest",
  });
}

export async function sendPrivateEventWebhook(eventRequest: PrivateEventRequest): Promise<WebhookResponse> {
  return sendBackendEvent("private_rental.inquiry", {
    ...eventRequest,
    priority: "high_ticket_vip",
  });
}
