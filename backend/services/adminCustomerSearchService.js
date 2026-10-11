function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function createAdminCustomerSearchService({ adminRoles, sanitizeUser }) {
  function search(db, query) {
    const term = normalizeSearchText(String(query || "").trim());
    const digits = term.replace(/\D/g, "");
    return (db.users || [])
      .filter((user) => user.active !== false && ["customer", ...adminRoles()].includes(user.role))
      .filter((user) => {
        if (term.length < 2 && digits.length < 2) return false;
        const name = normalizeSearchText(user.name);
        const email = normalizeSearchText(user.email);
        const cpf = String(user.cpf || "").replace(/\D/g, "");
        const phone = String(user.phone || "").replace(/\D/g, "");
        return name.includes(term) || email.includes(term) || (digits.length >= 2 && (phone.includes(digits) || cpf.includes(digits)));
      })
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
      .slice(0, 12)
      .map(sanitizeUser);
  }

  return { search };
}

module.exports = { createAdminCustomerSearchService };
