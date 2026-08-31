import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Política de Privacidade | Cine Cruzeiro",
  description: "Como o Cine Cruzeiro trata dados pessoais, pagamentos, ingressos digitais, e-mails e preferências de comunicação.",
};

const sections = [
  {
    title: "1. Quem controla seus dados",
    body: [
      "O Cine Cruzeiro utiliza esta plataforma para vender ingressos, administrar o Clube Cine Cruzeiro, validar QR Codes, operar a bomboniere e se comunicar com clientes. Para fins da LGPD, o cinema é o controlador dos dados usados nessas operações.",
      "Quando uma integração externa é usada, como Mercado Pago, Google, Google Wallet, SMTP/e-mail ou serviços de hospedagem, esses fornecedores atuam conforme seus próprios termos e políticas, além das instruções necessárias para executar o serviço contratado.",
    ],
  },
  {
    title: "2. Dados que podem ser coletados",
    body: [
      "Podemos coletar nome, e-mail, telefone/WhatsApp, CPF quando informado pelo usuário, senha criptografada, histórico de compras, ingressos, QR Codes, sessão escolhida, produtos de bomboniere, dados de assinatura do Clube, preferências de comunicação, registros de validação de entrada e informações técnicas como IP, dispositivo, navegador e cookies/localStorage.",
      "Google Analytics e Meta Pixel são carregados somente após consentimento. Esses serviços recebem eventos de navegação, visualização de filmes, início de checkout, itens adicionados, compra, assinatura e solicitação de eventos, sem envio de nome, e-mail, telefone ou CPF pelo Cine Cruzeiro.",
      "Dados de cartão e Pix são processados pelo Mercado Pago. O Cine Cruzeiro não deve armazenar número completo de cartão, CVV ou credenciais bancárias.",
    ],
  },
  {
    title: "3. Para que usamos os dados",
    body: [
      "Usamos os dados para criar conta, autenticar login, vender ingressos, emitir comprovantes, entregar QR Code e PDF, validar entrada, operar transferências de ingresso, administrar assinaturas do Clube, processar pagamentos, prevenir fraude, prestar suporte e cumprir obrigações legais ou regulatórias.",
      "Também podemos enviar e-mails transacionais, como confirmação de cadastro, redefinição de senha, pagamento aprovado, ingresso emitido, transferência de ingresso e avisos operacionais. Comunicações promocionais só devem ser enviadas quando permitidas e com opção de descadastro.",
    ],
  },
  {
    title: "4. Bases legais e compartilhamento",
    body: [
      "O tratamento pode ocorrer para execução de contrato, cumprimento de obrigação legal, exercício regular de direitos, prevenção a fraude, legítimo interesse operacional e consentimento quando exigido.",
      "Compartilhamos dados somente quando necessário com meios de pagamento, serviços de e-mail, hospedagem, carteira digital, autenticação, atendimento e autoridades públicas quando houver obrigação legal.",
    ],
  },
  {
    title: "5. Segurança e retenção",
    body: [
      "A plataforma usa autenticação, permissões administrativas, logs, criptografia de segredos de integração, QR Code validado no servidor e controle de status real do pagamento para reduzir riscos.",
      "Os dados são mantidos pelo tempo necessário para operação do cinema, histórico de compras, auditoria, obrigações fiscais, defesa de direitos e prevenção de fraude. Quando possível, dados desnecessários podem ser excluídos, anonimizados ou bloqueados.",
    ],
  },
  {
    title: "6. Seus direitos",
    body: [
      "Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, eliminação quando aplicável, informação sobre compartilhamento, revisão de decisões automatizadas quando existentes e revogação de consentimento.",
      "Para exercer direitos ou pedir suporte sobre privacidade, entre em contato pelo canal oficial do Cine Cruzeiro informado no atendimento do cinema.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#060a12] text-white">
      <SiteHeader mutedPrimaryAction />
      <main className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">Privacidade</p>
        <h1 className="mt-4 font-display text-4xl font-black sm:text-5xl">Política de Privacidade</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
          Última atualização: 25/08/2026. Esta política explica, em linguagem direta, como os dados são usados na compra de ingressos, Clube Cine Cruzeiro, bomboniere, validação de entrada e comunicações.
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
