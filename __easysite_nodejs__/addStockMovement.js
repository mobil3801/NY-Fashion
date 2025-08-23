
async function addStockMovement(movementData) {
  try {
    if (!movementData) {
      throw new Error('Movement data is required');
    }

    const {
      variant_id,
      delta,
      type,
      reason,
      ref_id,
      created_by
    } = movementData;

    // Validate required fields
    if (!variant_id || delta === undefined || !type) {
      throw new Error('Variant ID, delta, and type are required');
    }

    const vId = parseInt(variant_id);
    const deltaValue = parseInt(delta);
    
    if (isNaN(vId) || isNaN(deltaValue)) {
      throw new Error('Invalid variant ID or delta value');
    }

    // Validate movement type
    const validTypes = ['receipt', 'adjustment', 'sale', 'return'];
    if (!validTypes.includes(type)) {
      throw new Error('Invalid movement type');
    }

    // Insert stock movement record
    const query = `
      INSERT INTO stock_movements (
        variant_id, delta, type, ref_id, reason, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const createdAt = new Date().toISOString();
    
    const result = window.ezsite.db.query(query, [
      vId,
      deltaValue,
      type,
      ref_id || null,
      reason || '',
      created_by || null,
      createdAt
    ]);

    if (!result || result.length === 0) {
      throw new Error('Failed to create stock movement');
    }

    // Also update inventory lot if this affects current stock
    if (type === 'receipt' || type === 'adjustment' || type === 'return') {
      try {
        // Call updateStock to handle inventory lot changes
        const { data: updateResult, error: updateError } = await window.ezsite.apis.run({
          path: "updateStock",
          param: [vId, deltaValue, reason, result[0].id, created_by]
        });
        
        if (updateError) {
          console.warn('Stock update warning:', updateError);
        }
      } catch (stockError) {
        console.warn('Failed to update inventory lot:', stockError);
        // Don't fail the movement creation if lot update fails
      }
    }

    return {
      id: result[0].id,
      message: 'Stock movement recorded successfully'
    };

  } catch (error) {
    console.error('Add stock movement error:', error);
    throw new Error(`Failed to add stock movement: ${error.message}`);
  }
}
