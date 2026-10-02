import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact } from "@/components/LegalContact";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Termos de Uso | Cine Cruzeiro",
  description: "Regras de uso da plataforma de ingressos, Clube Cine Cruzeiro, bomboniere, QR Code e pagamentos do Cine Cruzeiro.",
};

const sections = [
  {
    "title": "1. Plataforma e responsável",
    "body": [
      "O Cine Cruzeiro oferece consulta de programação, compra de ingressos, bomboniere, planos do Clube e solicitação de eventos. A operação comercial é de J.R.A. de Cassio, identificada ao final desta página; a plataforma é desenvolvida pela LumixEngine.",
      "Estes termos complementam as informações da oferta e não afastam os direitos previstos na legislação brasileira. Leia também a Política de Privacidade para conhecer o uso dos dados pessoais."
    ]
  },
  {
    "title": "2. Conta e segurança",
    "body": [
      "Informe dados corretos, mantenha o e-mail acessível e proteja suas credenciais e QR Codes. Menores devem contar com o responsável legal quando necessário à contratação.",
      "Tentativas de fraude, invasão, uso duplicado de ingresso ou automação abusiva podem motivar restrições de segurança. Havendo bloqueio ou divergência, solicite análise ao suporte. Não compartilhe senhas ou códigos de autenticação com terceiros."
    ]
  },
  {
    "title": "3. Sessão, lugares e confirmação de compra",
    "body": [
      "Antes de pagar, confira filme, data, horário, sala, formato, classificação indicativa, tipo de ingresso, lugares e valor total. Os horários da programação seguem o horário local do cinema.",
      "A seleção de um lugar pode gerar uma reserva temporária, sujeita ao prazo mostrado no checkout. Selecionar o assento ou iniciar um pagamento não equivale à emissão do ingresso.",
      "O ingresso é liberado após confirmação do pagamento pelo provedor ou registro autorizado da bilheteria. Pagamentos pendentes, recusados ou expirados não liberam entrada. Se houver cobrança sem emissão, não refaça a compra antes de consultar o status e o suporte.",
      "Alterações posteriores no catálogo não modificam por si só uma compra já confirmada. Guarde a confirmação do pedido, que registra as condições da contratação."
    ]
  },
  {
    "title": "4. Acesso e ingresso digital",
    "body": [
      "Apresente o QR Code do ingresso válido e os comprovantes exigíveis para a modalidade adquirida, como meia-entrada. Observe a classificação indicativa e as condições de acompanhamento aplicáveis.",
      "A validação consulta o status do ingresso e registra a entrada. Uma cópia do QR Code não permite uso adicional; ingressos utilizados, cancelados ou integralmente reembolsados não dão novo acesso.",
      "Transferências, quando habilitadas, devem ser feitas pelo recurso da plataforma e ficam registradas. Elas não alteram a sessão, o preço nem os requisitos do ingresso. Em caso de dificuldade para acessar o documento, procure o atendimento com os dados do pedido."
    ]
  },
  {
    "title": "5. Bomboniere e eventos",
    "body": [
      "Itens, tamanhos, quantidades, preços e condições de retirada são os apresentados na compra. A retirada está sujeita à conferência do pedido, pagamento e registro de entrega. Consulte a equipe antes da compra sobre ingredientes e alergênicos.",
      "Se um item comprado não puder ser fornecido, o atendimento apresentará as alternativas cabíveis, sem impor substituição e preservando os direitos do consumidor.",
      "O envio de uma solicitação de evento não confirma reserva de sala nem pagamento. Disponibilidade, orçamento, serviços incluídos e condições de cancelamento devem ser confirmados antes da contratação."
    ]
  },
  {
    "title": "6. Clube e recorrência",
    "body": [
      "Cada plano informa preço, período, créditos, benefícios e regras de uso. Confira também se a cobrança é recorrente, a validade dos créditos e as condições de renovação antes de contratar. A ativação depende da confirmação do pagamento.",
      "O cancelamento da assinatura deve ser solicitado pelo recurso disponível na conta ou ao suporte. O atendimento deve verificar a interrupção das cobranças futuras junto ao provedor; a solicitação não pode ser ignorada por depender de integração externa.",
      "A existência de créditos usados ou de histórico financeiro não impede a solicitação de cancelamento. Eventuais valores devidos, direitos de reembolso e benefícios restantes são avaliados conforme a oferta contratada e a legislação, sem perda de direitos por exclusão do plano do catálogo."
    ]
  },
  {
    "title": "7. Cancelamentos, arrependimento e reembolsos",
    "body": [
      "Para pedir cancelamento, troca ou reembolso, contate suporte@cinecruzeiro.com.br com o número do pedido e a descrição da solicitação. Não envie dados completos do cartão. Os recursos disponíveis na conta também podem ser utilizados.",
      "Nas contratações a distância, aplica-se o direito de arrependimento previsto no artigo 49 do Código de Defesa do Consumidor, observadas as circunstâncias da contratação. Regras internas, prazos operacionais ou a dependência do processador de pagamentos não afastam direitos legais.",
      "Cancelamento de sessão, mudança relevante ou impossibilidade de fornecer o que foi comprado serão tratados pelo atendimento, preservando as alternativas legais de solução, inclusive restituição quando devida. Não é obrigatório aceitar crédito no lugar de reembolso assegurado por lei.",
      "A devolução será acompanhada pelo cinema e processada pelo meio aplicável à transação. O prazo de exibição do estorno pode variar por banco ou emissor; o suporte deve informar o andamento, sem confundir solicitação de reembolso com devolução concluída."
    ]
  },
  {
    "title": "8. Disponibilidade, conteúdo e versões",
    "body": [
      "Manutenção, falhas de rede ou integrações podem afetar temporariamente o serviço. O cinema prestará atendimento para conciliar pedidos e corrigir problemas; esta previsão não exclui responsabilidades legais.",
      "Marcas, artes e materiais exibidos pertencem aos respectivos titulares e sua apresentação no site não concede autorização geral de reprodução.",
      "A data abaixo identifica esta versão. Mudanças futuras não retiram direitos ou alteram retroativamente as condições de pedidos já confirmados. Aplicam-se a legislação brasileira e os meios de solução de conflitos assegurados ao consumidor."
    ]
  }
];

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#060a12] text-white">
      <SiteHeader mutedPrimaryAction />
      <main className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">Termos</p>
        <h1 className="mt-4 font-display text-4xl font-black sm:text-5xl">Termos de Uso</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
          Última atualização: 01/10/2026. Condições de uso da conta, compra, sessão, ingresso digital, bomboniere e Clube Cine Cruzeiro.
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
        <LegalContact />
        <p className="mt-6 text-sm"><Link href="/privacidade" className="text-gold-300 underline underline-offset-4">Consultar a Política de Privacidade</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
