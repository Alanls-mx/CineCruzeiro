((root) => {
  function createEmailCampaignTemplateEngine({ state, $, escapeHtml, money, campaignEditorAssetUrl, window, API_BASE }) {
    const EMAIL_CAMPAIGN_TEMPLATES = {
      announcement: {
        label: "Comunicado",
        family: "Relacionamento",
        layout: "announcement",
        kicker: "Cine Cruzeiro informa",
        subject: "Novidades do Cine Cruzeiro",
        headline: "Tem novidade no cinema",
        message: "Olá, {{nome}}. Preparamos uma novidade para você.",
        ctaLabel: "Ver programação",
        ctaUrl: "/filmes",
        media: true,
        mediaLabel: "Imagem opcional"
      },
      weekly: {
        label: "Programação da semana",
        family: "Programação",
        layout: "weekly",
        kicker: "Esta semana no Cine Cruzeiro",
        subject: "Sua programação de cinema para esta semana",
        headline: "Escolha sua próxima sessão",
        message: "Olá, {{nome}}. A programação da semana já está pronta.",
        ctaLabel: "Ver programação completa",
        ctaUrl: "/filmes",
        media: true,
        mediaLabel: "Pôsteres da programação + imagem opcional",
        catalog: "movie"
      },
      premiere: {
        label: "Grande estreia",
        family: "Programação",
        layout: "premiere",
        kicker: "Nova estreia",
        subject: "Uma nova estreia chegou ao Cine Cruzeiro",
        headline: "A próxima grande história começa aqui",
        message: "Olá, {{nome}}. Confira a nova estreia e escolha sua sessão.",
        ctaLabel: "Ver sessões",
        ctaUrl: "/filmes",
        media: false,
        mediaLabel: "Pôster automático do filme selecionado",
        catalog: "movie"
      },
      last_chance: {
        label: "Últimos dias",
        family: "Programação",
        layout: "lastChance",
        kicker: "Últimas sessões",
        subject: "Última chance para assistir no cinema",
        headline: "Não deixe para depois",
        message: "Olá, {{nome}}. Este filme está em seus últimos dias na nossa tela.",
        ctaLabel: "Garantir meu ingresso",
        ctaUrl: "/filmes",
        media: false,
        mediaLabel: "Pôster automático do filme selecionado",
        catalog: "movie"
      },
      promotion: {
        label: "Promoção",
        family: "Ofertas",
        layout: "promotion",
        kicker: "Oferta especial",
        subject: "Uma promoção especial para você",
        headline: "Cinema com uma condição especial",
        message: "Olá, {{nome}}. Aproveite esta condição por tempo limitado.",
        ctaLabel: "Aproveitar promoção",
        ctaUrl: "/filmes",
        media: true,
        mediaLabel: "Imagem opcional"
      },
      coupon: {
        label: "Cupom",
        family: "Ofertas",
        layout: "coupon",
        kicker: "Cupom de desconto",
        subject: "Seu cupom do Cine Cruzeiro chegou",
        headline: "Um desconto reservado para você",
        message: "Olá, {{nome}}. Use o código abaixo antes da data de validade.",
        ctaLabel: "Usar meu cupom",
        ctaUrl: "/filmes",
        media: false,
        mediaLabel: "Sem imagem adicional; código em destaque",
        coupon: true
      },
      concession: {
        label: "Produto da bomboniere",
        family: "Bomboniere",
        layout: "concession",
        kicker: "Para acompanhar o filme",
        subject: "Tem novidade na bomboniere",
        headline: "Seu cinema fica ainda melhor com esse sabor",
        message: "Olá, {{nome}}. Conheça este destaque da nossa bomboniere.",
        ctaLabel: "Ver na bomboniere",
        ctaUrl: "/filmes",
        media: false,
        mediaLabel: "Imagem automática do item selecionado",
        catalog: "concessions"
      },
      combo: {
        label: "Combo em destaque",
        family: "Bomboniere",
        layout: "combo",
        kicker: "Combo do cinema",
        subject: "Um combo especial para sua próxima sessão",
        headline: "Filme bom combina com bomboniere completa",
        message: "Olá, {{nome}}. Confira o combo escolhido para sua próxima visita.",
        ctaLabel: "Escolher uma sessão",
        ctaUrl: "/filmes",
        media: false,
        mediaLabel: "Imagens automáticas dos itens selecionados",
        catalog: "concessions"
      },
      club_plan: {
        label: "Plano do Clube",
        family: "Clube",
        layout: "clubPlan",
        kicker: "Clube Cine Cruzeiro",
        subject: "Um plano feito para quem ama cinema",
        headline: "Mais cinema, benefícios de verdade",
        message: "Olá, {{nome}}. Conheça um plano que acompanha o seu ritmo de cinema.",
        ctaLabel: "Assinar este plano",
        ctaUrl: "/clube",
        media: false,
        mediaLabel: "Imagem automática do plano selecionado",
        catalog: "clubPlan"
      },
      club: {
        label: "Novidades do Clube",
        family: "Clube",
        layout: "clubNews",
        kicker: "Clube Cine Cruzeiro",
        subject: "Novidades para membros do Clube",
        headline: "Mais cinema em cada visita",
        message: "Olá, {{nome}}. Conheça os benefícios preparados para membros do Clube.",
        ctaLabel: "Conhecer o Clube",
        ctaUrl: "/clube",
        media: true,
        mediaLabel: "Imagem do plano ou imagem opcional",
        catalog: "clubPlan"
      },
      birthday: {
        label: "Aniversário",
        family: "Relacionamento",
        layout: "birthday",
        kicker: "Hoje a sessão é sua",
        subject: "Feliz aniversário, {{nome}}!",
        headline: "Seu novo ciclo merece cinema",
        message: "Parabéns, {{nome}}! Desejamos um ano cheio de histórias inesquecíveis.",
        ctaLabel: "Escolher um filme",
        ctaUrl: "/filmes",
        media: false,
        mediaLabel: "Sem imagem adicional"
      },
      event: {
        label: "Evento especial",
        family: "Eventos",
        layout: "event",
        kicker: "Evento especial",
        subject: "Um evento especial no Cine Cruzeiro",
        headline: "Reserve esta data",
        message: "Olá, {{nome}}. Você está convidado para uma experiência especial no cinema.",
        ctaLabel: "Ver detalhes",
        ctaUrl: "/eventos",
        media: true,
        mediaLabel: "Imagem opcional"
      },
      ticket: {
        label: "Ingressos",
        family: "Serviço",
        layout: "ticket",
        kicker: "Seus ingressos",
        subject: "Informações sobre seus ingressos",
        headline: "Tudo pronto para sua sessão",
        message: "Olá, {{nome}}. Seus ingressos ficam disponíveis na sua conta. Chegue com antecedência e apresente o QR Code na entrada.",
        ctaLabel: "Ver meus ingressos",
        ctaUrl: "/conta/ingressos",
        media: false,
        mediaLabel: "Sem imagem adicional"
      },
      reactivation: {
        label: "Sentimos sua falta",
        family: "Relacionamento",
        layout: "reactivation",
        kicker: "A tela continua acesa",
        subject: "Sentimos sua falta no Cine Cruzeiro",
        headline: "Tem uma nova história esperando por você",
        message: "Olá, {{nome}}. Faz um tempo desde sua última visita. Venha conferir o que está em cartaz.",
        ctaLabel: "Voltar ao cinema",
        ctaUrl: "/filmes",
        media: true,
        mediaLabel: "Imagem opcional"
      }
    };

    function campaignObjectiveContext() {
      return {
        objective: $("emailCampaignObjective")?.value || state.emailCampaignObjective || "announcement",
        templateId: $("emailCampaignTemplate")?.value || state.emailCampaignTemplate || "announcement",
        templateSelectionMode: state.emailCampaignTemplateSelectionMode || "automatic",
        movie: selectedCampaignMovie(),
        movieIds: Array.from($("emailCampaignMovies")?.selectedOptions || []).map((option) => option.value),
        couponId: $("emailCampaignCoupon")?.value || "",
        concessions: selectedCampaignConcessions(),
        plan: selectedCampaignClubPlan(),
        recipientMode: $("emailCampaignAudience")?.value || "all"
      };
    }

    function resolveCampaignTemplateClient(context = campaignObjectiveContext()) {
      const objective = context.objective || "announcement";
      const movie = context.movie;
      const movieCount = new Set([...(context.movieIds || []), movie?.id].filter(Boolean).map(String)).size;
      const concessionCount = context.concessions?.length || 0;
      let scenario = "announcement";
      if (context.recipientMode === "birthday_manual") scenario = "birthday";
      else if (context.recipientMode === "reactivation") scenario = "reactivation";
      else if (context.couponId) scenario = "coupon";
      else if (objective === "concession") scenario = concessionCount > 1 ? "combo" : "concession";
      else if (objective === "club") scenario = context.plan ? "club_plan" : "club";
      else if (objective === "offer") scenario = "promotion";
      else if (objective === "event") scenario = "event";
      else if (objective === "programming") scenario = "programming";
      else if (objective === "movie") {
        if (!movie) return { templateId: "", reason: "Selecione o filme para montarmos o layout correto.", compatibleTemplates: [], scenario: "movie", incomplete: true, templateSelectionMode: "automatic" };
        const status = String(movie.status || "").toLowerCase();
        scenario = movie.lastChance === true || ["last_chance", "last_days", "ending_soon"].includes(status) ? "last_chance" : ["upcoming", "coming_soon", "em_breve"].includes(status) ? "premiere" : "now_playing";
      }
      const compatible = {
        announcement: ["announcement"], programming: ["weekly"], premiere: ["premiere", "weekly"], now_playing: ["weekly", "announcement"], last_chance: ["last_chance", "weekly"],
        promotion: ["promotion", "coupon"], coupon: ["coupon", "promotion"], concession: ["concession", "combo"], combo: ["combo", "concession"], club_plan: ["club_plan", "club"], club: ["club"],
        birthday: ["birthday", "announcement"], event: ["event", "announcement"], reactivation: ["reactivation", "announcement"]
      }[scenario] || ["announcement"];
      const incomplete = (objective === "movie" || objective === "programming") && movieCount === 0 || objective === "concession" && concessionCount === 0;
      const manual = context.templateSelectionMode === "manual" && compatible.includes(context.templateId);
      const reasons = {
        premiere: "Selecionado porque o filme ainda está em período de estreia.", now_playing: movieCount > 1 ? "Selecionado porque vários filmes foram escolhidos." : "Selecionado porque o filme está em cartaz.",
        last_chance: "Selecionado porque o catálogo marcou o filme como em últimas sessões.", programming: "Selecionado para apresentar a programação e as sessões disponíveis.", coupon: "Selecionado porque há um cupom válido vinculado à campanha.",
        promotion: "Selecionado para uma oferta editorial sem cupom vinculado.", concession: "Selecionado porque um item ativo da bomboniere foi escolhido.", combo: "Selecionado porque vários itens ativos da bomboniere foram escolhidos.",
        club_plan: "Selecionado porque um plano ativo do Clube foi escolhido.", club: "Selecionado para uma comunicação geral do Clube.", birthday: "Selecionado porque o público foi definido como aniversariantes.",
        reactivation: "Selecionado porque o público representa clientes sem compra recente.", event: "Selecionado porque o objetivo da campanha é um evento.", announcement: "Comunicação geral sem vínculo específico com catálogo."
      };
      return { templateId: incomplete ? "" : manual ? context.templateId : compatible[0], reason: incomplete ? objective === "concession" ? "Selecione ao menos um item ativo da bomboniere." : "Selecione o conteúdo para montarmos o layout correto." : manual ? "Layout escolhido manualmente e compatível com o conteúdo." : reasons[scenario], compatibleTemplates: incomplete ? [] : compatible, scenario, incomplete, templateSelectionMode: manual ? "manual" : "automatic" };
    }

    function campaignTemplateDefinition() {
      return EMAIL_CAMPAIGN_TEMPLATES[$("emailCampaignTemplate")?.value] || EMAIL_CAMPAIGN_TEMPLATES.announcement;
    }

    function campaignTemplateVariant(templateId = $("emailCampaignTemplate")?.value || "announcement") {
      const variant = state.emailCampaignTemplateVariant;
      return variant && variant.templateId === templateId ? variant : null;
    }

    function campaignTemplateTheme() {
      return campaignTemplateVariant()?.theme || {};
    }

    function campaignTemplateAbsoluteUrl(value) {
      const safe = campaignEditorAssetUrl(value);
      if (!safe) return "";
      try { return new URL(safe, window.location.origin).href; } catch { return safe; }
    }

    function campaignEmailLogoUrl(value) {
      const raw = String(value || "").trim() || `${API_BASE}/images/favicon-email.png`;
      return /\/images\/logo-display\.webp(?:[?#].*)?$/i.test(raw)
        ? raw.replace(/\/images\/logo-display\.webp(?:[?#].*)?$/i, "/images/favicon-email.png")
        : raw;
    }

    function selectedCampaignMovie() {
      return (state.content?.movies || []).find((item) => String(item.id) === String($("emailCampaignMovie")?.value || "")) || null;
    }

    function selectedCampaignMovies() {
      const selectedIds = [
        ...Array.from($("emailCampaignMovies")?.selectedOptions || []).map((option) => option.value),
        $("emailCampaignMovie")?.value || ""
      ].filter(Boolean).map(String);
      const uniqueIds = [...new Set(selectedIds)];
      if (!uniqueIds.length) return (state.content?.movies || []).filter((item) => item.status !== "hidden");
      return uniqueIds
        .map((id) => (state.content?.movies || []).find((item) => String(item.id) === id))
        .filter((item) => item && item.status !== "hidden");
    }

    function selectedCampaignConcession() {
      return selectedCampaignConcessions()[0] || null;
    }

    function selectedCampaignConcessions() {
      const ids = Array.from($("emailCampaignConcessions")?.selectedOptions || []).map((option) => option.value);
      const fallback = $("emailCampaignConcession")?.value;
      if (fallback && !ids.includes(fallback)) ids.unshift(fallback);
      return ids.map((id) => (state.content?.concessions || []).find((item) => String(item.id) === String(id))).filter(Boolean);
    }

    function selectedCampaignClubPlan() {
      return (state.content?.subscriptionPlans || []).find((item) => item.id === $("emailCampaignClubPlan")?.value) || null;
    }

    function campaignObjectiveCatalogType() {
      return {
        movie: "movie",
        programming: "movie",
        concession: "concessions",
        club: "clubPlan"
      }[$("emailCampaignObjective")?.value || state.emailCampaignObjective] || "";
    }

    function selectedCampaignCatalogMovies() {
      if (campaignTemplateDefinition().catalog !== "movie") return [];
      if (campaignTemplateDefinition().layout === "weekly") return selectedCampaignMovies();
      const movie = selectedCampaignMovie();
      return movie ? [movie] : [];
    }

    function selectedCampaignCatalogItem() {
      const type = campaignTemplateDefinition().catalog;
      if (type === "movie") {
        const movies = selectedCampaignCatalogMovies();
        return campaignTemplateDefinition().layout === "weekly" ? (movies.length ? movies : null) : (movies[0] || null);
      }
      if (type === "concessions") {
        const concessions = selectedCampaignConcessions();
        return concessions.length ? concessions : null;
      }
      return type === "clubPlan" ? selectedCampaignClubPlan() : null;
    }

    function campaignTemplateLogo(logoUrl, brandName, align = "left") {
      const accent = campaignTemplateTheme().accent || "#facc15";
      return `<div data-campaign-brand="true" style="margin:0 0 22px;text-align:${align}">${logoUrl ? `<img data-campaign-field="logo" src="${escapeHtml(logoUrl)}" width="126" alt="${escapeHtml(brandName)}" style="display:inline-block;width:126px;max-width:45%;height:auto;border:0;background-color:transparent">` : `<strong style="color:${accent};font-size:16px">${escapeHtml(brandName)}</strong>`}</div>`;
    }

    function campaignTemplateButton(label, url, color = "#facc15", align = "left") {
      color = campaignTemplateTheme().accent || color;
      return url && label ? `<div style="margin-top:24px;text-align:${align}"><a data-campaign-cta-index="0" href="${escapeHtml(url)}" style="display:inline-block;padding:13px 19px;background:${color};color:#050912;text-decoration:none;font-weight:800;border-radius:6px">${escapeHtml(label)}</a></div>` : "";
    }

    function campaignTemplateMessage(message, color = "#dbeafe", align = "left") {
      color = campaignTemplateTheme().text || color;
      return `<div data-campaign-field="message" style="color:${color};font-size:15px;line-height:1.65;text-align:${align}">${escapeHtml(message).replace(/\n/g, "<br>")}</div>`;
    }

    function campaignTemplateImage(url, alt, link = "", options = {}) {
      if (!url) return "";
      const width = Number(options.width || 560);
      const radius = Number(options.radius ?? 8);
      const image = `<img data-campaign-field="image" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;max-height:${Number(options.maxHeight || 380)}px;height:auto;margin:0 auto;border:0;border-radius:${radius}px;object-fit:contain">`;
      return link ? `<a href="${escapeHtml(link)}" style="display:block;text-decoration:none">${image}</a>` : image;
    }

    function campaignMovieSessions(movie) {
      const sessions = (movie?.sessions || []).filter((session) => session.date && session.time).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 4);
      if (!sessions.length) return `<span style="color:#93a4bd;font-size:12px">Consulte os horários na programação.</span>`;
      return sessions.map((session) => {
        const date = new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        return `<span style="display:inline-block;margin:4px 5px 0 0;padding:7px 9px;background:#172235;color:#f3f6fb;border-radius:5px;font-size:12px;font-weight:700">${escapeHtml(date)} · ${escapeHtml(session.time)}${session.format ? ` · ${escapeHtml(session.format)}` : ""}</span>`;
      }).join("");
    }

    function campaignTemplateShell(content, footer, options = {}) {
      const theme = campaignTemplateTheme();
      const border = theme.accent ? `4px solid ${theme.accent}` : options.topBorder || "0";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;margin:0 auto;background:${theme.background || options.background || "#0d1728"};font-family:'Segoe UI',Arial,sans-serif"><tbody><tr><td style="padding:${options.padding || "28px"};border-top:${border}">${content}<p data-campaign-field="footer" style="margin:28px 0 0;padding-top:18px;border-top:1px solid ${options.divider || "#233047"};color:${options.muted || "#93a4bd"};font-size:12px;line-height:1.5">${escapeHtml(footer)}</p></td></tr></tbody></table>`;
    }

    function campaignTemplateHtml() {
      const template = campaignTemplateDefinition();
      const brandName = $("emailBrandName")?.value.trim() || "Cine Cruzeiro";
      const logoUrl = campaignTemplateAbsoluteUrl(campaignEmailLogoUrl($("emailBrandLogoUrl")?.value));
      const headline = $("emailCampaignHeadline")?.value.trim() || template.headline;
      const message = $("emailCampaignMessage")?.value.trim() || template.message;
      const movie = selectedCampaignMovie();
      const concessions = selectedCampaignConcessions();
      const concession = concessions[0];
      const plan = selectedCampaignClubPlan();
      const catalogImage = template.catalog === "movie" ? movie?.posterUrl : template.catalog === "concessions" ? concession?.imageUrl : template.catalog === "clubPlan" ? plan?.imageUrl : "";
      const imageUrl = campaignTemplateAbsoluteUrl(catalogImage || (template.media ? $("emailCampaignImageUrl")?.value : ""));
      const imageAlt = $("emailCampaignImageAlt")?.value.trim() || headline;
      const imageLink = campaignTemplateAbsoluteUrl($("emailCampaignImageLink")?.value);
      const ctaLabel = $("emailCampaignCtaLabel")?.value.trim() || template.ctaLabel;
      const catalogUrl = template.catalog === "movie" && movie
        ? `/filmes/${movie.slug || movie.id}`
        : template.catalog === "clubPlan" && plan
          ? `/clube/assinar/${plan.id}`
          : template.ctaUrl;
      const ctaUrl = template.coupon ? "{{link_cupom}}" : campaignTemplateAbsoluteUrl($("emailCampaignCtaUrl")?.value || catalogUrl);
      const footer = $("emailBrandFooter")?.value.trim() || "Mensagem automática do Cine Cruzeiro.";
      const theme = campaignTemplateTheme();
      const logo = (align = "left") => campaignTemplateLogo(logoUrl, brandName, align);
      const kicker = (color = "#60a5fa", align = "left") => `<p style="margin:0 0 9px;color:${theme.accent || color};font-size:11px;font-weight:800;text-transform:uppercase;text-align:${align}">${escapeHtml(template.kicker)}</p>`;
      const title = (color = "#ffffff", size = 30, align = "left") => `<h1 data-campaign-field="headline" style="margin:0 0 18px;color:${theme.headline || color};font-size:${size}px;line-height:1.15;text-align:${align};word-break:normal">${escapeHtml(headline)}</h1>`;
      const linkedImage = campaignTemplateImage(imageUrl, imageAlt, imageLink || ctaUrl);

      if (template.layout === "premiere") {
        const genre = Array.isArray(movie?.genres) ? movie.genres[0] : Array.isArray(movie?.genre) ? movie.genre[0] : movie?.genre || "";
        const details = [movie?.duration ? String(movie.duration) : "", movie?.rating || movie?.classification || "", genre].filter(Boolean).join(" · ");
        const movieTitle = movie?.title || headline;
        const campaignHeadline = movie && headline !== movieTitle ? `<p data-campaign-field="headline" style="margin:0 0 10px;color:${theme.headline || "#ffffff"};font-size:18px;font-weight:800;text-align:center">${escapeHtml(headline)}</p>` : "";
        return campaignTemplateShell(`${logo("center")}${linkedImage ? `<div style="margin:0 auto 22px;max-width:300px;padding:10px;background:#050912;border-radius:8px">${linkedImage}</div>` : ""}${kicker("#facc15", "center")}<h1 data-campaign-field="movie-title" style="margin:0 0 10px;color:${theme.headline || "#ffffff"};font-size:32px;line-height:1.15;text-align:center">${escapeHtml(movieTitle)}</h1>${campaignHeadline}${details ? `<p style="margin:0 0 16px;color:#93a4bd;font-size:12px;text-align:center">${escapeHtml(details)}</p>` : ""}${campaignTemplateMessage(message, "#dbeafe", "center")}<div style="margin-top:18px;text-align:center">${campaignMovieSessions(movie)}</div>${campaignTemplateButton(ctaLabel, ctaUrl, "#facc15", "center")}`, footer, { topBorder: "4px solid #facc15" });
      }
      if (template.layout === "weekly") {
        const films = selectedCampaignMovies().slice(0, 4);
        const rows = films.map((item) => {
          const posterUrl = campaignTemplateAbsoluteUrl(item.posterUrl);
          const poster = posterUrl
            ? `<td width="78" valign="top" style="width:78px;padding:12px 0;border-bottom:1px solid #233047"><img src="${escapeHtml(posterUrl)}" alt="Pôster de ${escapeHtml(item.title || "filme")}" width="64" height="94" style="display:block;width:64px;height:94px;border:0;border-radius:5px;object-fit:cover"></td>`
            : "";
          return `<tr>${poster}<td valign="middle" style="padding:12px 0;border-bottom:1px solid #233047"><strong style="display:block;color:#f3f6fb;font-size:14px">${escapeHtml(item.title || "Filme")}</strong><div style="margin-top:4px">${campaignMovieSessions(item)}</div></td></tr>`;
        }).join("") || `<tr><td style="padding:14px 0;color:#93a4bd">Cadastre filmes e sessões para preencher esta agenda.</td></tr>`;
        return campaignTemplateShell(`${logo()}${linkedImage ? `<div style="margin:0 0 20px">${linkedImage}</div>` : ""}${kicker("#67e8f9")}${title()}${campaignTemplateMessage(message)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:20px;background:#09111f;border-radius:8px"><tbody>${rows}</tbody></table>${campaignTemplateButton(ctaLabel, ctaUrl, "#67e8f9")}`, footer, { background: "#07111d", topBorder: "4px solid #22d3ee" });
      }
      if (template.layout === "lastChance") {
        const movieTitle = movie?.title || headline;
        return campaignTemplateShell(`${logo("center")}${kicker("#fb7185", "center")}${linkedImage ? `<div style="margin:0 auto 20px;max-width:280px">${linkedImage}</div>` : ""}<h1 data-campaign-field="movie-title" style="margin:0 0 10px;color:${theme.headline || "#ffffff"};font-size:32px;line-height:1.15;text-align:center">${escapeHtml(movieTitle)}</h1>${movie && headline !== movieTitle ? `<p data-campaign-field="headline" style="margin:0 0 18px;color:#fecdd3;font-size:17px;font-weight:800;text-align:center">${escapeHtml(headline)}</p>` : ""}${campaignTemplateMessage(message, "#dbeafe", "center")}<div style="margin:20px 0;padding:13px;background:#2a1019;color:#fecdd3;text-align:center;border-radius:6px;font-size:13px;font-weight:800">Últimas sessões disponíveis</div><div style="text-align:center">${campaignMovieSessions(movie)}</div>${campaignTemplateButton(ctaLabel, ctaUrl, "#fb7185", "center")}`, footer, { background: "#120a11", divider: "#42202b", topBorder: "4px solid #fb7185" });
      }
      if (template.layout === "promotion") {
        const coupon = (state.content?.promotions || []).find((item) => item.id === $("emailCampaignCoupon")?.value);
        const audience = campaignAudienceLabel($("emailCampaignAudience")?.value);
        return campaignTemplateShell(`${logo()}<div style="padding:24px;background:#facc15;border-radius:8px;color:#050912">${kicker("#4a3700")}${title("#050912", 34)}${campaignTemplateMessage(message, "#241b00")}${coupon ? `<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid rgba(5,9,18,.28);font-size:13px;font-weight:800">${escapeHtml(coupon.title || "Oferta selecionada")} · ${escapeHtml(couponRuleLabel(coupon))}</p>` : ""}<p style="margin:10px 0 0;font-size:11px;font-weight:700;opacity:.75">Aplicável a: ${escapeHtml(audience)}</p>${campaignTemplateButton(ctaLabel, ctaUrl, "#050912")}</div>${linkedImage ? `<div style="margin-top:20px">${linkedImage}</div>` : ""}`, footer, { background: "#111827" });
      }
      if (template.layout === "coupon") {
        return campaignTemplateShell(`${logo("center")}${kicker("#45d6a1", "center")}${title("#ffffff", 30, "center")}${campaignTemplateMessage(message, "#dbeafe", "center")}<div style="margin:24px 0;padding:24px 18px;background:#f3f6fb;border:2px dashed #45d6a1;border-radius:8px;text-align:center"><span style="display:block;color:#475569;font-size:11px;text-transform:uppercase">Seu código exclusivo</span><strong style="display:block;margin:8px 0;color:#07111d;font-size:30px;letter-spacing:.08em">{{codigo_cupom}}</strong><span style="color:#475569;font-size:13px">Válido até {{validade_cupom}}</span></div>${campaignTemplateButton(ctaLabel, ctaUrl, "#45d6a1", "center")}`, footer, { background: "#071710", divider: "#1d4938" });
      }
      if (["concession", "combo"].includes(template.layout)) {
        const productName = concession?.name || headline;
        const items = (concession?.comboItems || []).map((item) => `${Number(item.quantity || 1)}x ${item.name}`).join(" · ");
        const compareAt = Number(concession?.compareAt || 0);
        const price = Number(concession?.price || 0);
        const accent = template.layout === "combo" ? "#fb7185" : "#f59e0b";
        const products = concessions.length > 1 ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:separate;border-spacing:0 8px">${concessions.map((item) => `<tr><td style="padding:11px;background:#172235;color:#f3f6fb;font-size:13px;border-radius:6px 0 0 6px"><strong>${escapeHtml(item.name || "Produto")}</strong>${item.description ? `<br><span style="color:#93a4bd;font-size:11px">${escapeHtml(item.description)}</span>` : ""}</td><td style="padding:11px;background:#172235;color:${accent};font-size:13px;font-weight:900;text-align:right;border-radius:0 6px 6px 0">${escapeHtml(money(item.price || 0))}</td></tr>`).join("")}</table>` : "";
        return campaignTemplateShell(`${logo()}${kicker(accent)}${linkedImage ? `<div style="margin:0 0 20px;background:#050912;padding:18px;border-radius:8px">${linkedImage}</div>` : ""}${products}<p style="margin:0 0 5px;color:#93a4bd;font-size:12px">${escapeHtml(concession?.badge || (template.layout === "combo" ? "Combo em destaque" : "Destaque da bomboniere"))}</p><h1 style="margin:0;color:#fff;font-size:28px">${escapeHtml(concessions.length > 1 ? `${concessions.length} itens da bomboniere` : productName)}</h1>${concessions.length <= 1 && price ? `<p style="margin:10px 0 18px;color:${accent};font-size:28px;font-weight:900">${compareAt > price ? `<span style="margin-right:8px;color:#64748b;font-size:14px;text-decoration:line-through">${escapeHtml(money(compareAt))}</span>` : ""}${escapeHtml(money(price))}</p>` : ""}${items ? `<p style="margin:0 0 16px;padding:12px;background:#172235;color:#dbeafe;border-radius:6px;font-size:13px">${escapeHtml(items)}</p>` : ""}${campaignTemplateMessage(message)}${campaignTemplateButton(ctaLabel, ctaUrl, accent)}`, footer, { background: template.layout === "combo" ? "#160b12" : "#141008", topBorder: `4px solid ${accent}` });
      }
      if (template.layout === "clubPlan") {
        const benefits = (plan?.benefits || []).slice(0, 6).map((benefit) => `<tr><td width="22" valign="top" style="width:22px;padding:5px 0;color:#45d6a1;font-weight:900">✓</td><td style="padding:5px 0;color:#dbeafe;font-size:14px">${escapeHtml(benefit)}</td></tr>`).join("");
        return campaignTemplateShell(`${logo("center")}${kicker("#facc15", "center")}${linkedImage ? `<div style="margin:0 auto 18px;max-width:360px">${linkedImage}</div>` : ""}<h1 style="margin:0;text-align:center;color:#fff;font-size:30px">${escapeHtml(plan?.name || headline)}</h1>${plan ? `<p style="margin:9px 0 20px;text-align:center;color:#facc15;font-size:30px;font-weight:900">${escapeHtml(money(plan.monthlyPrice || 0))}<span style="font-size:13px;color:#93a4bd">/mês</span></p><div style="margin:0 auto 20px;max-width:390px;padding:12px;background:#172235;border-radius:7px;text-align:center;color:#dbeafe;font-size:13px"><strong style="color:#fff">${Number(plan.includedTickets || 0)} ingressos por mês</strong>${Number(plan.ticketDiscountPercent || 0) ? ` · ${Number(plan.ticketDiscountPercent)}% nos ingressos` : ""}${Number(plan.concessionDiscountPercent || 0) ? ` · ${Number(plan.concessionDiscountPercent)}% na bomboniere` : ""}</div>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:420px">${benefits ? `<tbody>${benefits}</tbody>` : ""}</table><div style="margin-top:16px">${campaignTemplateMessage(message, "#dbeafe", "center")}</div>${campaignTemplateButton(ctaLabel, ctaUrl, "#facc15", "center")}`, footer, { background: "#081425", topBorder: "4px solid #facc15" });
      }
      if (template.layout === "birthday") {
        return campaignTemplateShell(`${logo("center")}<div style="padding:30px 20px;background:#172554;border-radius:8px;text-align:center">${kicker("#fda4af", "center")}${title("#ffffff", 34, "center")}${campaignTemplateMessage(message, "#dbeafe", "center")}<div style="margin:22px auto 0;width:54px;height:3px;background:#facc15"></div>${campaignTemplateButton(ctaLabel, ctaUrl, "#facc15", "center")}</div>`, footer, { background: "#090d1c" });
      }
      if (template.layout === "event") {
        return campaignTemplateShell(`${linkedImage ? `<div style="margin:-28px -28px 24px">${campaignTemplateImage(imageUrl, imageAlt, imageLink || ctaUrl, { width: 620, radius: 0, maxHeight: 330 })}</div>` : ""}${logo("center")}${kicker("#67e8f9", "center")}${title("#ffffff", 32, "center")}${campaignTemplateMessage(message, "#dbeafe", "center")}${campaignTemplateButton(ctaLabel, ctaUrl, "#67e8f9", "center")}`, footer, { background: "#07111d", topBorder: "4px solid #22d3ee" });
      }
      if (template.layout === "ticket") {
        return campaignTemplateShell(`${logo()}${kicker("#45d6a1")}${title()}<div style="margin:18px 0;padding:18px;background:#09111f;border:1px solid #233047;border-radius:7px"><strong style="display:block;color:#fff;font-size:16px">Ingresso digital disponível</strong><span style="display:block;margin-top:6px;color:#93a4bd;font-size:13px">Acesse sua conta para visualizar o QR Code, a sessão e a poltrona.</span></div>${campaignTemplateMessage(message)}${campaignTemplateButton(ctaLabel, ctaUrl, "#45d6a1")}`, footer, { background: "#0b1523", topBorder: "4px solid #45d6a1" });
      }
      if (template.layout === "reactivation") {
        return campaignTemplateShell(`${logo()}${linkedImage ? `<div style="margin:0 0 22px">${linkedImage}</div>` : ""}${kicker("#60a5fa")}${title("#fff", 31)}${campaignTemplateMessage(message)}${campaignTemplateButton(ctaLabel, ctaUrl, "#60a5fa")}`, footer, { background: "#0a1220", topBorder: "4px solid #4d8dff" });
      }
      if (template.layout === "clubNews") {
        const clubOffer = $("emailCampaignClubOffer")?.value.trim();
        const planDetails = plan ? `<div style="margin:18px auto;padding:14px;background:#172235;border-radius:7px;color:#dbeafe;text-align:center;font-size:13px"><strong style="display:block;color:#fff;font-size:16px">${escapeHtml(plan.name || "Plano do Clube")}</strong><span style="display:block;margin-top:5px;color:#facc15;font-size:20px;font-weight:900">${escapeHtml(money(plan.monthlyPrice || 0))}/mês</span><span style="display:block;margin-top:6px">${Number(plan.includedTickets || 0)} ingresso(s) por mês${Number(plan.ticketDiscountPercent || 0) ? ` · ${Number(plan.ticketDiscountPercent)}% de desconto` : ""}</span></div>` : "";
        return campaignTemplateShell(`${logo("center")}${kicker("#facc15", "center")}${title("#fff", 30, "center")}${linkedImage ? `<div style="margin:0 auto 20px;max-width:430px">${linkedImage}</div>` : ""}${planDetails}${clubOffer ? `<p style="margin:0 0 16px;padding:13px;background:#0d1728;border-top:3px solid #45d6a1;color:#dbeafe;font-size:14px">${escapeHtml(clubOffer).replace(/\n/g, "<br>")}</p>` : ""}${campaignTemplateMessage(message, "#dbeafe", "center")}${campaignTemplateButton(ctaLabel, ctaUrl, "#facc15", "center")}`, footer, { background: "#081425", topBorder: "4px solid #facc15" });
      }
      return campaignTemplateShell(`${logo()}${kicker()}${title()}${linkedImage ? `<div style="margin:0 0 22px">${linkedImage}</div>` : ""}${campaignTemplateMessage(message)}${campaignTemplateButton(ctaLabel, ctaUrl)}`, footer, { topBorder: "4px solid #4d8dff" });
    }

    return { EMAIL_CAMPAIGN_TEMPLATES, campaignObjectiveContext, resolveCampaignTemplateClient, campaignTemplateDefinition, campaignTemplateVariant, campaignTemplateTheme, campaignTemplateAbsoluteUrl, campaignEmailLogoUrl, selectedCampaignMovie, selectedCampaignMovies, selectedCampaignConcession, selectedCampaignConcessions, selectedCampaignClubPlan, campaignObjectiveCatalogType, selectedCampaignCatalogMovies, selectedCampaignCatalogItem, campaignTemplateLogo, campaignTemplateButton, campaignTemplateMessage, campaignTemplateImage, campaignMovieSessions, campaignTemplateShell, campaignTemplateHtml };
  }

  const api = Object.freeze({ createEmailCampaignTemplateEngine });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.emailCampaignTemplateEngine = api; }
})(globalThis);
