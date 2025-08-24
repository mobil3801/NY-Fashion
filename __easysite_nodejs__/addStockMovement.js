
function addStockMovement(movementData) {
  try {
    // Input validation
    if (!movementData || typeof movementData !== 'object') {
      throw new Error('Movement data is required');
    }

    const {
      product_id,
      variant_id,
      delta,
      type,
      reason,
      ref_id,
      created_by
    } = movementData;

    // Validate required fields
    if (!product_id || isNaN(parseInt(product_id))) {
      throw new Error('Valid product ID is required');
    }

    if (delta === undefined || delta === null || isNaN(parseInt(delta))) {
      throw new Error('Valid delta value is required');
    }

    if (!type || typeof type !== 'string') {
      throw new Error('Movement type is required');
    }

    const pId = parseInt(product_id);
    const vId = variant_id ? parseInt(variant_id) : null;
    const deltaValue = parseInt(delta);

    // Validate movement type
    const validTypes = ['receipt', 'adjustment', 'sale', 'return', 'transfer', 'loss', 'found'];
    const sanitizedType = type.toString().trim().toLowerCase();
    if (!validTypes.includes(sanitizedType)) {
      throw new Error('Invalid movement type');
    }

    // Validate delta value constraints
    if (deltaValue === 0) {
      throw new Error('Delta value cannot be zero');
    }

    if (Math.abs(deltaValue) > 100000) {
      throw new Error('Delta value too large');
    }

    // Sanitize optional fields
    const sanitizedReason = (reason || '').toString().trim().slice(0, 500);
    const refId = ref_id && !isNaN(parseInt(ref_id)) ? parseInt(ref_id) : null;
    const createdBy = created_by && !isNaN(parseInt(created_by)) ? parseInt(created_by) : null;

    // Insert stock movement record
    const insertQuery = `
      INSERT INTO stock_movements (
        product_id, variant_id, delta, type, ref_id, reason, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, created_at
    `;

    const createdAt = new Date().toISOString();

    let result;
    try {
      result = window.ezsite.db.query(insertQuery, [
        pId,
        vId,
        deltaValue,
        sanitizedType,
        refId,
        sanitizedReason,
        createdBy,
        createdAt
      ]);
    } catch (dbError) {
      if (dbError.message && dbError.message.includes('foreign key')) {
        throw new Error('Invalid product or variant ID');
      }
      throw new Error('Database operation failed');
    }

    if (!result || result.length === 0) {
      throw new Error('Failed to create stock movement');
    }

    // Update product stock if this is a stock-affecting movement
    if (['receipt', 'adjustment', 'return', 'found'].includes(sanitizedType) && deltaValue > 0) {
      try {
        // Update current stock in products table
        const updateStockQuery = `
          UPDATE products 
          SET 
            current_stock = COALESCE(current_stock, 0) + $1,
            updated_at = $2
          WHERE id = $3
        `;
        window.ezsite.db.query(updateStockQuery, [deltaValue, createdAt, pId]);
      } catch (stockUpdateError) {
        // Log warning but don't fail the movement creation
      }
    } else if (['sale', 'adjustment', 'transfer', 'loss'].includes(sanitizedType) && deltaValue < 0) {
      try {
        // Decrease stock but don't allow negative
        const updateStockQuery = `
          UPDATE products 
          SET 
            current_stock = GREATEST(0, COALESCE(current_stock, 0) + $1),
            updated_at = $2
          WHERE id = $3
        `;
        window.ezsite.db.query(updateStockQuery, [deltaValue, createdAt, pId]);
      } catch (stockUpdateError) {
        // Log warning but don't fail the movement creation
      }
    }

    return {
      id: result[0].id,
      created_at: result[0].created_at,
      message: 'Stock movement recorded successfully',
      success: true
    };

  } catch (error) {
    // Production error handling
    if (error.message.includes('required') || error.message.includes('Invalid')) {
      throw new Error(error.message);
    }
    
    throw new Error('Failed to record stock movement. Please try again.');
  }
}
