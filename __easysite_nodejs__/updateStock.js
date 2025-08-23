
function updateStock(variantId, quantityChange, reason = 'manual', refId = null, createdBy = null) {
  try {
    if (!variantId || quantityChange === undefined || quantityChange === 0) {
      throw new Error('Variant ID and non-zero quantity change are required');
    }

    const vId = parseInt(variantId);
    const qtyChange = parseInt(quantityChange);
    
    if (isNaN(vId) || isNaN(qtyChange)) {
      throw new Error('Invalid variant ID or quantity change');
    }

    // Start transaction simulation (PostgreSQL doesn't have explicit transaction support in this context)
    
    // First, check if inventory lot exists
    const existingLotQuery = `
      SELECT id, qty_on_hand 
      FROM inventory_lots 
      WHERE variant_id = $1
    `;
    
    const existingLot = window.ezsite.db.query(existingLotQuery, [vId]);
    
    let newQuantity;
    
    if (existingLot && existingLot.length > 0) {
      // Update existing lot
      const currentQty = parseInt(existingLot[0].qty_on_hand) || 0;
      newQuantity = currentQty + qtyChange;
      
      // Don't allow negative stock
      if (newQuantity < 0) {
        throw new Error('Insufficient stock. Cannot reduce below zero.');
      }
      
      const updateQuery = `
        UPDATE inventory_lots 
        SET qty_on_hand = $1 
        WHERE variant_id = $2
      `;
      
      window.ezsite.db.query(updateQuery, [newQuantity, vId]);
      
    } else {
      // Create new lot
      if (qtyChange < 0) {
        throw new Error('Cannot create inventory lot with negative quantity');
      }
      
      newQuantity = qtyChange;
      
      const insertQuery = `
        INSERT INTO inventory_lots (variant_id, qty_on_hand, location)
        VALUES ($1, $2, $3)
      `;
      
      window.ezsite.db.query(insertQuery, [vId, newQuantity, 'main']);
    }
    
    // Record stock movement
    const movementQuery = `
      INSERT INTO stock_movements (variant_id, delta, type, ref_id, reason, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    const movementType = qtyChange > 0 ? 'receipt' : 'adjustment';
    const createdAt = new Date().toISOString();
    
    const movementResult = window.ezsite.db.query(movementQuery, [
      vId,
      qtyChange,
      movementType,
      refId,
      reason || 'manual',
      createdBy,
      createdAt
    ]);
    
    return {
      success: true,
      newQuantity: newQuantity,
      movementId: movementResult && movementResult[0] ? movementResult[0].id : null,
      message: `Stock updated successfully. New quantity: ${newQuantity}`
    };
    
  } catch (error) {
    console.error('Update stock error:', error);
    throw new Error(`Failed to update stock: ${error.message}`);
  }
}
