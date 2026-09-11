const { timedQuery, runMutation } = require("./repositorySupport");

function mapConcession(row) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku || "",
    name: row.name,
    description: row.description || "",
    imageUrl: row.image_url || "",
    badge: row.badge || "",
    price: Number(row.price || 0),
    compareAt: row.compare_at === null ? "" : Number(row.compare_at || 0),
    category: row.category || "combo",
    stock: row.available === null || row.available === undefined ? "" : Number(row.available),
    reserved: Number(row.reserved || 0),
    sold: Number(row.sold || 0),
    maxPerOrder: Number(row.max_per_order || 8),
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order || 100),
    tags: Array.isArray(row.tags) ? row.tags : [],
    comboItems: Array.isArray(row.combo_items) ? row.combo_items : [],
    active: row.active !== false,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
  };
}

const SELECT = `SELECT concessions.*, concession_inventory.available,
  concession_inventory.reserved, concession_inventory.sold
  FROM concessions LEFT JOIN concession_inventory ON concession_inventory.concession_id=concessions.id`;

async function findById(id) {
  const result = await timedQuery(null, `${SELECT} WHERE concessions.id=$1`, [id], { repository: "concession", operation: "findById" });
  return mapConcession(result.rows[0]);
}

async function list() {
  const result = await timedQuery(null, `${SELECT} ORDER BY concessions.sort_order, concessions.name`, [], { repository: "concession", operation: "list" });
  return result.rows.map(mapConcession);
}

async function writeConcession(client, item, updateInventory = false) {
  await timedQuery(client, `INSERT INTO concessions
    (id,sku,name,description,image_url,badge,price,compare_at,category,max_per_order,featured,sort_order,tags,combo_items,active,updated_at)
    VALUES ($1,NULLIF($2,''),$3,$4,$5,$6,$7,NULLIF($8,'')::numeric,$9,$10,$11,$12,$13,$14::jsonb,$15,now())
    ON CONFLICT (id) DO UPDATE SET sku=EXCLUDED.sku,name=EXCLUDED.name,description=EXCLUDED.description,
      image_url=EXCLUDED.image_url,badge=EXCLUDED.badge,price=EXCLUDED.price,compare_at=EXCLUDED.compare_at,
      category=EXCLUDED.category,max_per_order=EXCLUDED.max_per_order,featured=EXCLUDED.featured,
      sort_order=EXCLUDED.sort_order,tags=EXCLUDED.tags,combo_items=EXCLUDED.combo_items,active=EXCLUDED.active,updated_at=now()`, [
    item.id, item.sku || "", item.name, item.description || "", item.imageUrl || "", item.badge || "",
    Number(item.price || 0), item.compareAt === "" ? "" : Number(item.compareAt || 0), item.category || "combo",
    Number(item.maxPerOrder || 8), Boolean(item.featured), Number(item.sortOrder || 100), item.tags || [],
    JSON.stringify(item.comboItems || []), item.active !== false
  ], { repository: "concession", operation: "upsert" });
  if (updateInventory) {
    await timedQuery(client, `INSERT INTO concession_inventory (concession_id,available,reserved,sold,updated_at)
      VALUES ($1,$2,$3,$4,now())
      ON CONFLICT (concession_id) DO UPDATE SET available=EXCLUDED.available,reserved=EXCLUDED.reserved,
        sold=EXCLUDED.sold,updated_at=now()`, [
      item.id, item.stock === "" ? null : Number(item.stock), Number(item.reserved || 0), Number(item.sold || 0)
    ], { repository: "concession", operation: "inventory.set" });
  } else {
    await timedQuery(client, `INSERT INTO concession_inventory (concession_id,available,reserved,sold,updated_at)
      VALUES ($1,$2,$3,$4,now()) ON CONFLICT (concession_id) DO NOTHING`, [
      item.id, item.stock === "" ? null : Number(item.stock), Number(item.reserved || 0), Number(item.sold || 0)
    ], { repository: "concession", operation: "inventory.ensure" });
  }
  const result = await timedQuery(client, `${SELECT} WHERE concessions.id=$1`, [item.id], { repository: "concession", operation: "returning" });
  return mapConcession(result.rows[0]);
}

async function upsert(item, options = {}) {
  return runMutation({
    event: options.event || "repository.concession.update",
    metadata: { repository: "concession", operation: options.operation || "upsert", concessionId: item.id },
    audit: options.audit
  }, (client) => writeConcession(client, item, options.updateInventory === true));
}

function create(item, options = {}) {
  return upsert(item, { ...options, updateInventory: true, event: "repository.concession.create", operation: "create" });
}

function update(item, options = {}) {
  return runMutation({
    event: "repository.concession.update",
    metadata: { repository: "concession", operation: "update", concessionId: item.id },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, `UPDATE concessions SET
      sku=NULLIF($2,''),name=$3,description=$4,image_url=$5,badge=$6,price=$7,
      compare_at=NULLIF($8,'')::numeric,category=$9,max_per_order=$10,featured=$11,
      sort_order=$12,tags=$13,combo_items=$14::jsonb,active=$15,updated_at=now()
      WHERE id=$1 RETURNING id`, [
      item.id, item.sku || "", item.name, item.description || "", item.imageUrl || "", item.badge || "",
      Number(item.price || 0), item.compareAt === "" ? "" : Number(item.compareAt || 0), item.category || "combo",
      Number(item.maxPerOrder || 8), Boolean(item.featured), Number(item.sortOrder || 100), item.tags || [],
      JSON.stringify(item.comboItems || []), item.active !== false
    ], { repository: "concession", operation: "update" });
    if (!result.rowCount) return null;
    if (options.updateInventory === true) {
      const expected = options.expectedInventory || {};
      const inventory = await timedQuery(client, `UPDATE concession_inventory SET
        available=$2,reserved=$3,sold=$4,updated_at=now()
        WHERE concession_id=$1
          AND available IS NOT DISTINCT FROM $5
          AND reserved=$6 AND sold=$7
        RETURNING concession_id`, [
        item.id, item.stock === "" ? null : Number(item.stock), Number(item.reserved || 0), Number(item.sold || 0),
        expected.stock === "" ? null : Number(expected.stock), Number(expected.reserved || 0), Number(expected.sold || 0)
      ], { repository: "concession", operation: "inventory.set" });
      if (!inventory.rowCount) {
        const error = new Error("O estoque mudou enquanto o produto era editado. Atualize os dados e tente novamente.");
        error.code = "CONCESSION_INVENTORY_CHANGED";
        error.statusCode = 409;
        throw error;
      }
    }
    const joined = await timedQuery(client, `${SELECT} WHERE concessions.id=$1`, [item.id], { repository: "concession", operation: "returning" });
    return mapConcession(joined.rows[0]);
  });
}

async function updateInventory(id, deltas = {}, options = {}) {
  return runMutation({
    event: "repository.concession.inventory",
    metadata: { repository: "concession", operation: "inventory", concessionId: id },
    audit: options.audit
  }, async (client) => {
    const availableDelta = Number(deltas.available || 0);
    const reservedDelta = Number(deltas.reserved || 0);
    const soldDelta = Number(deltas.sold || 0);
    const result = await timedQuery(client, `UPDATE concession_inventory SET
      available=CASE WHEN available IS NULL THEN NULL ELSE available+$2 END,
      reserved=reserved+$3, sold=sold+$4, updated_at=now()
      WHERE concession_id=$1
        AND (available IS NULL OR available+$2 >= 0)
        AND reserved+$3 >= 0 AND sold+$4 >= 0
      RETURNING *`, [id, availableDelta, reservedDelta, soldDelta], { repository: "concession", operation: "inventory.atomic" });
    if (!result.rowCount) {
      const error = new Error("Estoque insuficiente ou movimentação inválida.");
      error.code = "CONCESSION_INVENTORY_CONFLICT";
      error.statusCode = 409;
      throw error;
    }
    const joined = await timedQuery(client, `${SELECT} WHERE concessions.id=$1`, [id], { repository: "concession", operation: "inventory.returning" });
    return mapConcession(joined.rows[0]);
  });
}

async function remove(id, options = {}) {
  return runMutation({
    event: "repository.concession.delete",
    metadata: { repository: "concession", operation: "delete", concessionId: id },
    audit: options.audit
  }, async (client) => {
    const before = await timedQuery(client, `${SELECT} WHERE concessions.id=$1`, [id], { repository: "concession", operation: "delete.find" });
    await timedQuery(client, "DELETE FROM concessions WHERE id=$1", [id], { repository: "concession", operation: "delete" });
    return mapConcession(before.rows[0]);
  });
}

module.exports = { mapConcession, findById, list, create, update, updateInventory, remove };
