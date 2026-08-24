---
name: Cine Cruzeiro
description: Cabine de operação cinematográfica contemporânea para venda e gestão.
colors:
  control-room-black: "#060a12"
  navy-surface: "#0d1420"
  raised-navy: "#172235"
  divider-steel: "#233047"
  text-white: "#f3f6fb"
  text-muted: "#9aa8bd"
  premiere-gold: "#f5c518"
  action-blue: "#4d8dff"
  success-mint: "#45d6a1"
  alert-rose: "#ff7185"
typography:
  headline:
    fontFamily: "Bahnschrift, Aptos Display, Segoe UI Variable, sans-serif"
    fontSize: "clamp(24px, 2vw, 30px)"
    fontWeight: 760
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 720
    lineHeight: 1.3
    letterSpacing: "0.05em"
rounded:
  control: "7px"
  surface: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.premiere-gold}"
    textColor: "{colors.control-room-black}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
    height: "40px"
  button-ghost:
    backgroundColor: "{colors.raised-navy}"
    textColor: "{colors.text-white}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
    height: "40px"
  input:
    backgroundColor: "{colors.control-room-black}"
    textColor: "{colors.text-white}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "42px"
  surface:
    backgroundColor: "{colors.navy-surface}"
    textColor: "{colors.text-white}"
    rounded: "{rounded.surface}"
    padding: "18px"
---

# Design System: Cine Cruzeiro

## Overview

**Creative North Star: "Cabine de Projeção"**

O sistema traduz a precisão silenciosa de uma cabine de cinema para uma interface operacional contemporânea. Superfícies navy foscas, ritmo compacto e hierarquia clara deixam os dados em primeiro plano; a marca aparece na disciplina dos detalhes, não em decoração temática.

O dourado funciona como a luz de estreia: raro, inequívoco e reservado à ação principal. Azul, mint e rose comunicam interação, sucesso e risco sem disputar atenção com o conteúdo.

**Key Characteristics:**

- Alta densidade com agrupamento claro.
- Superfícies tonais em vez de caixas contornadas em excesso.
- Dourado restrito a decisões primárias.
- Imagens preservadas, recortadas e sem fundos artificiais.
- Movimento breve e funcional.

## Colors

A paleta combina preto azulado, aço frio e acentos funcionais com o dourado da marca.

**The Premiere Light Rule.** O dourado marca a ação decisiva ou o estado selecionado; ações repetidas usam azul ou neutros.

## Typography

**Display Font:** Bahnschrift com Aptos Display e Segoe UI Variable como fallback.
**Body Font:** Segoe UI Variable com Segoe UI e system-ui como fallback.

**Character:** clara, compacta e contemporânea, com números tabulares nas áreas financeiras.

- **Headline:** títulos de página de 24–30px, peso 760 e entrelinha curta.
- **Body:** 14px com entrelinha 1.45; descrições longas ficam limitadas a aproximadamente 68 caracteres por linha.
- **Label:** 11px, peso 720 e espaçamento discreto para cabeçalhos e campos.

## Layout

O painel usa header de 66px, sidebar de 216px e workspace fluido. Formulários de edição recebem mais largura que listas de seleção. Aos 1120px a sidebar vira drawer; abaixo de 820px os grids se tornam uma coluna e as ações essenciais ocupam a largura disponível. Nenhuma tarefa comum depende de rolagem horizontal.

## Elevation & Depth

O sistema é tonal por padrão. Sombras suaves separam superfícies principais e modais; linhas internas de baixa opacidade organizam listas e tabelas sem criar uma grade pesada.

**The Structural Shadow Rule.** Sombra comunica sobreposição ou agrupamento, nunca decoração luminosa.

## Shapes

Controles usam cantos de 7px e superfícies 8px. Pills ficam restritas a estados e badges. Imagens usam seus próprios formatos e sempre preservam a proporção com `object-fit: contain` quando o conteúdo precisa ser inspecionado.

## Components

### Buttons

Botões primários usam dourado somente na ação principal. Botões secundários usam navy elevado; perigo usa rose translúcido. Todos têm foco azul de 2px e transição de 0.2s.

### Cards / Containers

Superfícies usam navy fosco, raio de 8px e separação tonal. Listas são blocos contínuos com divisores discretos; itens selecionados recebem uma superfície elevada e sinal dourado pequeno.

### Inputs / Fields

Campos têm fundo quase preto, borda aço e altura mínima de 42px. Hover reforça a borda; foco usa azul com halo discreto. Placeholder é visível, mas subordinado ao valor.

### Navigation

A navegação lateral é compacta. O item ativo usa navy elevado, texto branco, ícone dourado e um único ponto de confirmação. No mobile ela vira drawer com backdrop.

### Media Upload

Áreas de upload usam borda tracejada, botão de arquivo dourado e prévia sem fundo claro. A imagem é persistida antes de o formulário confirmar o salvamento.

## Do's and Don'ts

### Do:

- **Do** manter ações primárias únicas e fáceis de localizar.
- **Do** usar azul, mint e rose para estados funcionais.
- **Do** adaptar tabelas para linhas empilhadas no celular.
- **Do** preservar transparência e proporção de imagens enviadas.

### Don't:

- **Don't** usar dourado em todos os botões de uma lista.
- **Don't** aninhar cards decorativos ou criar bordas em cada agrupamento.
- **Don't** esconder ações comuns atrás de rolagem horizontal.
- **Don't** substituir ícones por emojis ou glifos inconsistentes.
