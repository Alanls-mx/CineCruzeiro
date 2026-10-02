import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact } from "@/components/LegalContact";
import { PrivacyMeasurementControl } from "@/components/PrivacyMeasurementControl";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Política de Privacidade | Cine Cruzeiro",
  description: "Como o Cine Cruzeiro trata dados pessoais, pagamentos, ingressos digitais, e-mails e preferências de comunicação.",
};

const sections = [
  {
    "title": "1. Responsável e atendimento",
    "body": [
      "O Cine Cruzeiro, operado por J.R.A. de Cassio, é responsável pelas decisões sobre o uso dos dados de seus clientes nesta plataforma. A identificação e o contato do responsável estão ao final desta página.",
      "A LumixEngine desenvolve a plataforma. Fornecedores de hospedagem, e-mail, autenticação, carteira digital e pagamento participam da operação conforme o serviço utilizado. O uso de cada integração depende de sua disponibilidade no site."
    ]
  },
  {
    "title": "2. Dados utilizados na operação",
    "body": [
      "O cadastro pode incluir nome, e-mail, telefone, documento quando solicitado e credencial de acesso. A senha é armazenada como hash, não em texto legível. Login com Google, quando escolhido, utiliza os dados de perfil necessários à autenticação.",
      "Compras e assinaturas registram pedidos, valores, status de pagamento, filmes, sessões, lugares, ingressos, retiradas da bomboniere, benefícios e créditos do Clube. Transferências e validações de ingresso mantêm registros para evitar uso duplicado e permitir atendimento.",
      "Solicitações de eventos e suporte contêm os dados e mensagens informados por você. Registros técnicos podem incluir endereço IP, navegador, horários de acesso, falhas e ações administrativas.",
      "O pagamento é processado pelo provedor integrado. O sistema utiliza identificadores e resultados da transação para conciliação, emissão e reembolso; não armazena o número completo do cartão nem seu código de segurança. Não envie senha, CVV ou códigos de autenticação ao atendimento."
    ]
  },
  {
    "title": "3. Finalidades e bases do tratamento",
    "body": [
      "Cadastro, compra, emissão e validação de ingressos, bomboniere, Clube e suporte utilizam dados necessários à execução do serviço contratado ou solicitado. Registros fiscais e contábeis atendem obrigações legais; dados estritamente necessários também podem ser preservados para defesa de direitos.",
      "A segurança e a prevenção de uso indevido consideram a necessidade do tratamento e os direitos dos clientes. Medição publicitária e comunicações dependentes de autorização utilizam o consentimento específico, que pode ser retirado. A navegação no site não equivale a autorizar todas as finalidades."
    ]
  },
  {
    "title": "4. E-mails e automações",
    "body": [
      "Confirmações, recuperação de acesso, informações de pagamento, entrega de ingresso, transferências e avisos sobre a sessão são comunicações de serviço. Recusar publicidade não impede o recebimento desses avisos necessários.",
      "Campanhas e fluxos de e-mail, inclusive automações com n8n quando habilitadas, podem organizar envios por preferências de comunicação, situação da assinatura e histórico de relacionamento com o cinema. As mensagens promocionais oferecem um link de descadastro; o suporte também recebe solicitações sobre essas comunicações.",
      "O sistema registra tentativas e resultados de entrega para tratar falhas, evitar repetição e respeitar o descadastro. As automações de comunicação não substituem o atendimento para dúvidas sobre pedidos ou direitos."
    ]
  },
  {
    "title": "5. Cookies e medição",
    "body": [
      "Cookies de sessão e armazenamento no navegador sustentam autenticação, segurança e preferências. Bloquear todos os dados do site no navegador pode encerrar sua sessão ou prejudicar a compra.",
      "Quando configurados, Google Analytics e Meta Pixel são carregados após a escolha de aceitar medição. Podem receber identificadores técnicos, IP e eventos de navegação e conversão. Os eventos de negócio filtram campos como nome, e-mail, telefone e CPF; isso não significa navegação anônima perante esses fornecedores.",
      "Você pode recusar novas medições pelo controle abaixo. Para apagar cookies já gravados, utilize também as configurações do navegador. A escolha de medição é independente do descadastro de e-mails."
    ]
  },
  {
    "title": "6. Compartilhamento e fornecedores",
    "body": [
      "Dados necessários podem ser enviados ao processador de pagamentos, serviços de e-mail, hospedagem e ferramentas de automação. Google e Google Wallet recebem dados relacionados às funções que você escolher utilizar. Obrigações legais e ordens válidas também podem exigir fornecimento de informações.",
      "Fornecedores podem processar dados fora do Brasil. A contratação e o uso desses serviços devem observar as garantias aplicáveis às transferências internacionais. As políticas dos fornecedores complementam, mas não afastam, as responsabilidades do cinema."
    ]
  },
  {
    "title": "7. Segurança, histórico e conservação",
    "body": [
      "A plataforma utiliza permissões de acesso, autenticação administrativa, registros de operação e conferência do ingresso no servidor. Nenhuma medida elimina todos os riscos; comunique suspeitas de acesso indevido ao suporte.",
      "A conservação depende da finalidade: conta e preferências durante seu uso; pedidos e movimentos financeiros durante os períodos exigidos para obrigações e defesa de direitos; registros operacionais enquanto necessários à segurança e à apuração de incidentes.",
      "Retirar um filme do catálogo ou cancelar uma assinatura não apaga automaticamente o histórico de compras e conciliação. Backups e registros sujeitos a obrigação de guarda podem persistir após a exclusão de dados de uso corrente. Solicitações de eliminação são avaliadas considerando essas limitações."
    ]
  },
  {
    "title": "8. Direitos, menores e atualizações",
    "body": [
      "Você pode solicitar acesso, correção, informações sobre compartilhamento, portabilidade e eliminação quando cabíveis, além de retirar consentimento e pedir revisão de decisões exclusivamente automatizadas que afetem seus interesses. O atendimento pode confirmar sua identidade de modo proporcional antes de fornecer ou alterar dados.",
      "Solicitações de privacidade devem ser enviadas ao e-mail abaixo, descrevendo o pedido sem anexar documentos desnecessários. A resposta observará os prazos legais. Também é possível recorrer à ANPD e aos órgãos de defesa do consumidor.",
      "A contratação por menores deve contar com a participação do responsável legal, conforme aplicável. Não solicitamos dados de crianças para publicidade; responsáveis podem contatar o cinema sobre informações de menores.",
      "Mudanças relevantes nesta política serão identificadas pela data da versão publicada. Quando uma nova finalidade exigir consentimento, a atualização do texto não substitui essa autorização."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#060a12] text-white">
      <SiteHeader mutedPrimaryAction />
      <main className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">Privacidade</p>
        <h1 className="mt-4 font-display text-4xl font-black sm:text-5xl">Política de Privacidade</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
          Última atualização: 01/10/2026. Saiba como tratamos os dados de conta, compras, Clube, bomboniere, entrada e comunicações.
        </p>
        <div className="mt-10 grid gap-6">
          {sections.map((section) => (
            <section key={section.title} className="border-t border-white/10 pt-6">
              <h2 className="font-display text-2xl font-black">{section.title}</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.title === "5. Cookies e medição" && <PrivacyMeasurementControl />}
              </div>
            </section>
          ))}
        </div>
        <LegalContact />
        <p className="mt-6 text-sm"><Link href="/termos" className="text-gold-300 underline underline-offset-4">Consultar os Termos de Uso</Link></p>
      </main>
      <SiteFooter />
    </div>
  );
}
