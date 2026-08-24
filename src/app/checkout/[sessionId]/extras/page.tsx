import { CheckoutPage } from "@/components/CheckoutPage";

export default async function CheckoutExtras({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <CheckoutPage sessionId={sessionId} step="extras" />;
}
