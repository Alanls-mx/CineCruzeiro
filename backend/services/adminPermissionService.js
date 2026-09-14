const ADMIN_PERMISSION_KEYS = [
  "dashboard.view",
  "ticket_finance.view",
  "ticket_finance.configure",
  "movies.view",
  "movies.create",
  "movies.edit",
  "movies.delete",
  "sessions.manage",
  "rooms.view",
  "rooms.create",
  "rooms.edit",
  "rooms.delete",
  "sessions.autocorrect",
  "ticket_types.view",
  "ticket_types.create",
  "ticket_types.edit",
  "ticket_types.delete",
  "box_office.sell",
  "box_office.courtesy",
  "tickets.view",
  "tickets.validate",
  "orders.view",
  "orders.edit",
  "orders.cancel",
  "orders.archive",
  "orders.delete",
  "orders.refund",
  "orders.print",
  "orders.resend",
  "payments.view",
  "concessions.view",
  "concessions.sell",
  "concessions.edit",
  "concessions.delete",
  "concessions.refund",
  "marketing.view",
  "marketing.manage",
  "club.view",
  "club.manage",
  "club.credits",
  "integrations.view",
  "integrations.manage",
  "logs.view",
  "logs.delete",
  "users.manage",
  "settings.view",
  "settings.manage",
  "media.manage"
];

const LEGACY_ADMIN_PERMISSION_EXPANSIONS = {
  "movies.manage": ["movies.view", "movies.create", "movies.edit", "movies.delete", "sessions.manage"],
  "rooms.manage": ["rooms.view", "rooms.create", "rooms.edit", "rooms.delete", "sessions.manage", "sessions.autocorrect"],
  "ticket_types.manage": ["ticket_types.view", "ticket_types.create", "ticket_types.edit", "ticket_types.delete"],
  "box_office.manage": ["box_office.sell", "box_office.courtesy", "tickets.view", "orders.view", "orders.print"],
  "orders.manage": ["orders.view", "orders.edit", "orders.cancel", "orders.archive", "orders.delete", "orders.refund", "orders.print", "orders.resend", "payments.view", "tickets.view"],
  "concessions.manage": ["concessions.view", "concessions.sell", "concessions.edit", "concessions.delete", "concessions.refund"],
  "marketing.manage": ["marketing.view", "marketing.manage"],
  "club.manage": ["club.view", "club.manage", "club.credits"],
  "integrations.manage": ["integrations.view", "integrations.manage"],
  "settings.manage": ["settings.view", "settings.manage", "users.manage"],
  "dashboard.view": ["dashboard.view"],
  "tickets.validate": ["tickets.validate"],
  "logs.view": ["logs.view"],
  "media.manage": ["media.manage"]
};

function roleAlias(role) {
  const value = String(role || "").trim();
  if (value === "master") return "owner";
  if (value === "seller") return "operator";
  return value;
}

function expandAdminPermissions(permissions = []) {
  const allowed = new Set(ADMIN_PERMISSION_KEYS);
  const expanded = [];
  for (const permission of Array.isArray(permissions) ? permissions : []) {
    const values = LEGACY_ADMIN_PERMISSION_EXPANSIONS[permission] || [permission];
    values.forEach((value) => {
      if (allowed.has(value)) expanded.push(value);
    });
  }
  return [...new Set(expanded)];
}

function roleAdminPermissions(role) {
  const normalized = roleAlias(role);
  if (normalized === "owner") return [...ADMIN_PERMISSION_KEYS];
  if (normalized === "manager") {
    return ADMIN_PERMISSION_KEYS.filter((permission) => ![
      "integrations.view",
      "integrations.manage",
      "settings.manage",
      "users.manage",
      "logs.delete"
    ].includes(permission));
  }
  if (normalized === "operator") {
    return [
      "dashboard.view",
      "movies.view",
      "rooms.view",
      "tickets.view",
      "tickets.validate",
      "orders.view",
      "orders.print",
      "payments.view",
      "box_office.sell",
      "concessions.view",
      "concessions.sell"
    ];
  }
  return [];
}

function effectiveAdminPermissions(user) {
  if (!user) return [];
  if (roleAlias(user.role) === "owner") return [...ADMIN_PERMISSION_KEYS];
  if (user.useCustomPermissions === true) return expandAdminPermissions(user.adminPermissions);
  return roleAdminPermissions(user.role);
}

function adminHasPermission(user, permission) {
  return roleAlias(user?.role) === "owner" || effectiveAdminPermissions(user).includes(permission);
}

module.exports = {
  ADMIN_PERMISSION_KEYS,
  LEGACY_ADMIN_PERMISSION_EXPANSIONS,
  adminHasPermission,
  effectiveAdminPermissions,
  expandAdminPermissions,
  roleAdminPermissions,
  roleAlias
};
