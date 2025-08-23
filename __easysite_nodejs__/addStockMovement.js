
function addStockMovement(movementData) {
    const {
        product_id,
        variant_id,
        movement_type,
        reference_type,
        reference_id,
        quantity,
        unit_cost,
        total_cost,
        notes,
        created_by
    } = movementData;

    // Insert stock movement
    const sql = `
        INSERT INTO stock_movements 
        (product_id, variant_id, movement_type, reference_type, reference_id, 
         quantity, unit_cost, total_cost, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = window.ezsite.db.exec(sql, [
        product_id, variant_id, movement_type, reference_type, reference_id,
        quantity, unit_cost || 0, total_cost || 0, notes, created_by
    ]);

    // Update stock levels based on movement type
    if (variant_id) {
        // Update variant stock
        let stockUpdateSql;
        if (['receipt', 'return', 'adjustment'].includes(movement_type) && quantity > 0) {
            stockUpdateSql = `
                UPDATE product_variants 
                SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            window.ezsite.db.exec(stockUpdateSql, [quantity, variant_id]);
        } else if (['sale', 'adjustment', 'transfer'].includes(movement_type)) {
            stockUpdateSql = `
                UPDATE product_variants 
                SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND current_stock >= ?
            `;
            window.ezsite.db.exec(stockUpdateSql, [Math.abs(quantity), variant_id, Math.abs(quantity)]);
        }
    }

    // Log the movement in audit trail
    const auditSql = `
        INSERT INTO audit_log (table_name, record_id, action, new_values, user_id)
        VALUES ('stock_movements', ?, 'INSERT', ?, ?)
    `;
    
    window.ezsite.db.exec(auditSql, [
        result.lastInsertRowid,
        JSON.stringify(movementData),
        created_by
    ]);

    return {
        success: true,
        id: result.lastInsertRowid,
        message: 'Stock movement recorded successfully'
    };
}
