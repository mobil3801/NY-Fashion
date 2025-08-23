
function getStockMovements(productId, variantId = null, limit = 50) {
  let sql = `
        SELECT 
            sm.*,
            p.name as product_name,
            p.sku as product_sku,
            pv.variant_name,
            pv.sku as variant_sku,
            u.username as created_by_name
        FROM stock_movements sm
        LEFT JOIN products p ON sm.product_id = p.id
        LEFT JOIN product_variants pv ON sm.variant_id = pv.id
        LEFT JOIN users u ON sm.created_by = u.id
        WHERE sm.product_id = ?
    `;

  let params = [productId];

  if (variantId) {
    sql += ' AND sm.variant_id = ?';
    params.push(variantId);
  }

  sql += ' ORDER BY sm.created_at DESC LIMIT ?';
  params.push(limit);

  const movements = window.ezsite.db.prepare(sql).all(...params);

  return { movements };
}