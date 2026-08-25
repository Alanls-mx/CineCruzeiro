import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Termos de Uso | Cine Cruzeiro",
  description: "Regras de uso da plataforma de ingressos, Clube Cine Cruzeiro, bomboniere, QR Code e pagamentos do Cine Cruzeiro.",
};

const sections = [
  {
    title: "1. Uso da plataforma",
    body: [
      "A plataforma do Cine Cruzeiro permite consultar programação, comprar ingressos, adicionar itens de bomboniere, assinar o Clube Cine Cruzeiro, acessar ingressos digitais, baixar PDF, usar Google Wallet quando disponível e validar entrada por QR Code.",
      "Você deve informar dados verdadeiros e manter sua conta protegida. O uso indevido de QR Code, transferência irregular, tentativa de fraude, automação abusiva ou acesso não autorizado pode levar ao bloqueio de pedidos, conta ou ingresso.",
    ],
  },
  {
    title: "2. Compra de ingressos e pagamento",
    body: [
      "Ingressos e extras só são liberados após confirmação real do pagamento pelo provedor integrado ou registro autorizado pela bilheteria. Pagamentos pendentes, processando, recusados, expirados ou cancelados não geram direito de entrada.",
      "Preços, sessões, disponibilidade e produtos podem mudar conforme programação, estoque e capacidade da sala. Sessões encerradas ou indisponíveis não devem permanecer à venda.",
    ],
  },
  {
    title: "3. QR Code, entrada e transferência",
    body: [
      "O ingresso digital é pessoal e validado pelo status real no servidor. Apresente o QR Code na entrada e chegue com antecedência. Ingressos usados, cancelados, reembolsados, expirados ou sem pagamento aprovado não liberam acesso.",
      "A transferência de ingresso, quando disponível, só ocorre para outro usuário cadastrado e não pode ser usada para burlar regras de pagamento, validade ou segurança.",
    ],
  },
  {
    title: "4. Clube Cine Cruzeiro",
    body: [
      "O Clube Cine Cruzeiro concede créditos e benefícios conforme o plano contratado. Créditos, ciclos, cancelamentos e renovações seguem as regras exibidas no site e só são ativados após pagamento aprovado.",
      "Cancelamentos devem interromper cobranças futuras quando a assinatura recorrente estiver vinculada a provedor externo, sem apagar histórico necessário para auditoria, suporte e obrigações legais.",
    ],
  },
  {
    title: "5. Cancelamentos, reembolsos e atendimento",
    body: [
      "Solicitações de cancelamento, troca, reembolso ou suporte são analisadas conforme a legislação brasileira, Código de Defesa do Consumidor, regras do provedor de pagamento e política operacional do cinema.",
      "Em compras digitais, prazos, meios de reembolso e eventuais limitações dependem do status da sessão, uso do ingresso, aprovação do pagamento e canais oficiais de atendimento.",
    ],
  },
  {
    title: "6. Responsabilidades e alterações",
    body: [
      "O Cine Cruzeiro trabalha para manter o sistema disponível e seguro, mas pode haver interrupções por manutenção, internet, serviços de pagamento, hospedagem, e-mail ou integrações de terceiros.",
      "Estes termos podem ser atualizados para refletir mudanças na operação, nas integrações ou na legislação aplicável. A versão publicada no site é a referência para uso da plataforma.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#060a12] text-white">
      <SiteHeader mutedPrimaryAction />
      <main className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">Termos</p>
        <h1 className="mt-4 font-display text-4xl font-black sm:text-5xl">Termos de Uso</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
          Última atualização: 25/08/2026. Estes termos organizam as regras de compra, conta, Clube, QR Code, bomboniere e pagamentos na plataforma do Cine Cruzeiro.
        </p>
        <div className="mt-10 grid gap-6">
          {sections.map((section) => (
            <section key={section.title} className="border-t border-white/10 pt-6">
              <h2 className="font-display text-2xl font-black">{section.title}</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
