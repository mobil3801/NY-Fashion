
function getStockMovements(productId, variantId = null, limit = 50) {
  try {
    // Input validation
    if (!productId || isNaN(parseInt(productId))) {
      throw new Error('Valid product ID is required');
    }

    const pId = parseInt(productId);
    const queryLimit = Math.min(Math.max(1, parseInt(limit) || 50), 500); // Between 1 and 500

    let query = `
      SELECT 
        sm.id,
        sm.product_id,
        sm.variant_id,
        sm.delta,
        sm.type,
        sm.reason,
        sm.ref_id,
        sm.created_at,
        sm.created_by,
        p.name as product_name,
        p.sku as product_sku,
        pv.variant_name,
        pv.sku as variant_sku
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      LEFT JOIN product_variants pv ON sm.variant_id = pv.id
      WHERE sm.product_id = $1
    `;

    const params = [pId];
    let paramIndex = 2;

    // Add variant filter if provided
    if (variantId && !isNaN(parseInt(variantId))) {
      query += ` AND sm.variant_id = $${paramIndex}`;
      params.push(parseInt(variantId));
      paramIndex++;
    }

    // Add ordering and limit
    query += ` ORDER BY sm.created_at DESC LIMIT $${paramIndex}`;
    params.push(queryLimit);

    // Execute query
    let result;
    try {
      result = window.ezsite.db.query(query, params);
    } catch (dbError) {
      throw new Error('Database query failed. Please try again.');
    }

    if (!result || !Array.isArray(result)) {
      return { movements: [] };
    }

    // Process and validate results
    const movements = result.
    filter((movement) => movement && typeof movement === 'object').
    map((movement) => {
      try {
        // Sanitize and validate fields
        const sanitizeText = (text, maxLength = 255) => {
          return (text || '').toString().trim().slice(0, maxLength);
        };

        return {
          id: parseInt(movement.id) || 0,
          product_id: parseInt(movement.product_id) || 0,
          variant_id: parseInt(movement.variant_id) || null,
          delta: parseInt(movement.delta) || 0,
          type: sanitizeText(movement.type, 50),
          reason: sanitizeText(movement.reason, 500),
          ref_id: parseInt(movement.ref_id) || null,
          created_at: movement.created_at,
          created_by: parseInt(movement.created_by) || null,
          product_name: sanitizeText(movement.product_name, 100),
          product_sku: sanitizeText(movement.product_sku, 50),
          variant_name: sanitizeText(movement.variant_name, 100),
          variant_sku: sanitizeText(movement.variant_sku, 50)
        };
      } catch (formatError) {
        return null;
      }
    }).
    filter((movement) => movement !== null);

    return {
      movements,
      total: movements.length
    };

  } catch (error) {
    // Production error handling
    throw new Error('Failed to retrieve stock movements. Please try again.');
  }
}