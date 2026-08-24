import { CheckoutPage } from "@/components/CheckoutPage";

export default async function CheckoutPagamento({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <CheckoutPage sessionId={sessionId} step="pagamento" />;
}
