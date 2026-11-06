function createAdminCustomerHandler({ adminCustomerSearch, sendJson }) {
  return function handleAdminCustomerRoute({ req, res, pathname, method, db }) {
    if (pathname !== "/api/admin/customers" || method !== "GET") return false;
    const query = new URL(req.url, `http://${req.headers.host}`).searchParams.get("query") || "";
    sendJson(res, 200, { customers: adminCustomerSearch.search(db, query) });
    return true;
  };
}

module.exports = { createAdminCustomerHandler };
