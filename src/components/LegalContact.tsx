export function LegalContact() {
  return (
    <section className="mt-10 border-t border-white/10 pt-6" aria-labelledby="legal-contact-title">
      <h2 id="legal-contact-title" className="font-display text-2xl font-black">Responsável e contato</h2>
      <address className="mt-4 space-y-2 text-sm not-italic leading-7 text-slate-300">
        <p>Cine Cruzeiro · J.R.A. de Cassio · CNPJ 05.869.495/0001-03</p>
        <p>Rua Capitão Avelino Bastos, 837, Centro, Cruzeiro/SP · CEP 12701-440</p>
        <p>Atendimento, cancelamentos e privacidade: <a className="break-all text-gold-300 underline underline-offset-4" href="mailto:suporte@cinecruzeiro.com.br">suporte@cinecruzeiro.com.br</a></p>
      </address>
    </section>
  );
}
