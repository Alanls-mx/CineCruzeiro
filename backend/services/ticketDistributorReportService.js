function money(value) {
  const numeric = Number(value);
  return Number(Math.max(0, Number.isFinite(numeric) ? numeric : 0).toFixed(2));
}

function signedMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeRules(input = {}) {
  const percent = (value, fallback) => {
    const numeric = Number(value);
    return Math.min(100, Math.max(0, Number.isFinite(numeric) ? numeric : fallback));
  };
  return {
    distributorPercent: percent(input.distributorPercent, 50),
    courtesyPercent: percent(input.courtesyPercent, percent(input.distributorPercent, 50)),
    clubTicketFee: money(input.clubTicketFee ?? 10)
  };
}

function calculateTicketDistributorReport(entries = [], inputRules = {}) {
  const rules = normalizeRules(inputRules);
  const grouped = new Map();

  for (const entry of entries) {
    const category = ["club", "courtesy"].includes(entry.category) ? entry.category : "paid";
    const paidAmount = money(entry.paidAmount);
    const standardFullPrice = money(entry.standardFullPrice);
    let distributorCost = 0;
    let cinemaNet = 0;

    if (category === "club") {
      distributorCost = rules.clubTicketFee;
      cinemaNet = 0;
    } else if (category === "courtesy") {
      distributorCost = money(standardFullPrice * rules.courtesyPercent / 100);
      cinemaNet = -distributorCost;
    } else {
      distributorCost = money(paidAmount * rules.distributorPercent / 100);
      cinemaNet = signedMoney(paidAmount - distributorCost);
    }

    const label = String(entry.type || (category === "club" ? "Clube de assinatura" : category === "courtesy" ? "Indicação / Cortesia" : "Ingresso pago"));
    const key = `${category}:${label}`;
    const current = grouped.get(key) || {
      category,
      type: label,
      quantity: 0,
      grossRevenue: 0,
      distributorCost: 0,
      cinemaNet: 0
    };
    current.quantity += 1;
    current.grossRevenue = money(current.grossRevenue + paidAmount);
    current.distributorCost = money(current.distributorCost + distributorCost);
    current.cinemaNet = signedMoney(current.cinemaNet + cinemaNet);
    grouped.set(key, current);
  }

  const rows = [...grouped.values()].sort((a, b) => a.category.localeCompare(b.category) || a.type.localeCompare(b.type, "pt-BR"));
  const totals = rows.reduce((total, row) => ({
    quantity: total.quantity + row.quantity,
    grossRevenue: money(total.grossRevenue + row.grossRevenue),
    distributorCost: money(total.distributorCost + row.distributorCost),
    cinemaNet: signedMoney(total.cinemaNet + row.cinemaNet)
  }), { quantity: 0, grossRevenue: 0, distributorCost: 0, cinemaNet: 0 });
  totals.retentionPercent = totals.grossRevenue > 0
    ? Number((totals.cinemaNet / totals.grossRevenue * 100).toFixed(2))
    : 0;

  return { rules, rows, totals };
}

module.exports = { calculateTicketDistributorReport, normalizeRules };
