import { CheckoutPage } from "@/components/CheckoutPage";

export default async function CheckoutIngressos({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ novaCompra?: string }> }) {
  const { sessionId } = await params;
  const query = await searchParams;
  return <CheckoutPage sessionId={sessionId} step="ingressos" startNew={query.novaCompra === "1"} />;
}
