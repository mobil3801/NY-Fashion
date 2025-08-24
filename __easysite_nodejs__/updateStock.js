
function updateStock(productId, quantityChange, reason = 'manual', refId = null, createdBy = null) {
  try {
    // Input validation
    if (!productId || isNaN(parseInt(productId))) {
      throw new Error('Valid product ID is required');
    }

    if (quantityChange === undefined || quantityChange === null || isNaN(parseInt(quantityChange))) {
      throw new Error('Valid quantity change is required');
    }

    const pId = parseInt(productId);
    const qtyChange = parseInt(quantityChange);

    if (qtyChange === 0) {
      throw new Error('Quantity change cannot be zero');
    }

    if (Math.abs(qtyChange) > 100000) {
      throw new Error('Quantity change too large');
    }

    // Sanitize optional parameters
    const sanitizedReason = (reason || 'manual').toString().trim().slice(0, 500);
    const finalRefId = refId && !isNaN(parseInt(refId)) ? parseInt(refId) : null;
    const finalCreatedBy = createdBy && !isNaN(parseInt(createdBy)) ? parseInt(createdBy) : null;

    // Check if product exists and get current stock
    const productQuery = `
      SELECT id, name, current_stock, min_stock_level, is_trackable, is_active
      FROM products 
      WHERE id = $1
    `;

    let productResult;
    try {
      productResult = window.ezsite.db.query(productQuery, [pId]);
    } catch (dbError) {
      throw new Error('Database query failed');
    }

    if (!productResult || productResult.length === 0) {
      throw new Error('Product not found');
    }

    const product = productResult[0];

    if (!product.is_active) {
      throw new Error('Cannot update stock for inactive product');
    }

    if (!product.is_trackable) {
      throw new Error('Cannot update stock for non-trackable product');
    }

    // Calculate new stock level
    const currentStock = Math.max(0, parseInt(product.current_stock) || 0);
    const newStock = Math.max(0, currentStock + qtyChange);

    // Validate stock constraints
    if (qtyChange < 0 && Math.abs(qtyChange) > currentStock) {
      throw new Error(`Insufficient stock. Current stock: ${currentStock}, requested decrease: ${Math.abs(qtyChange)}`);
    }

    const timestamp = new Date().toISOString();

    // Start transaction-like operations
    try {
      // 1. Update product stock
      const updateProductQuery = `
        UPDATE products 
        SET 
          current_stock = $1,
          updated_at = $2
        WHERE id = $3
        RETURNING current_stock
      `;

      const updateResult = window.ezsite.db.query(updateProductQuery, [newStock, timestamp, pId]);

      if (!updateResult || updateResult.length === 0) {
        throw new Error('Failed to update product stock');
      }

      // 2. Record stock movement
      const movementQuery = `
        INSERT INTO stock_movements (
          product_id, variant_id, delta, type, ref_id, reason, created_by, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      const movementType = qtyChange > 0 ? 'receipt' : 'adjustment';

      const movementResult = window.ezsite.db.query(movementQuery, [
      pId,
      null, // variant_id - null for product-level updates
      qtyChange,
      movementType,
      finalRefId,
      sanitizedReason,
      finalCreatedBy,
      timestamp]
      );

      // 3. Update or create inventory lot (if table exists)
      try {
        const lotCheckQuery = `
          SELECT id, qty_on_hand 
          FROM inventory_lots 
          WHERE product_id = $1 AND variant_id IS NULL
          LIMIT 1
        `;

        const existingLot = window.ezsite.db.query(lotCheckQuery, [pId]);

        if (existingLot && existingLot.length > 0) {
          // Update existing lot
          const updateLotQuery = `
            UPDATE inventory_lots 
            SET 
              qty_on_hand = $1,
              updated_at = $2
            WHERE id = $3
          `;
          window.ezsite.db.query(updateLotQuery, [newStock, timestamp, existingLot[0].id]);
        } else if (newStock > 0) {
          // Create new lot only if we have positive stock
          const insertLotQuery = `
            INSERT INTO inventory_lots (product_id, variant_id, qty_on_hand, location, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          window.ezsite.db.query(insertLotQuery, [pId, null, newStock, 'main', timestamp, timestamp]);
        }
      } catch (lotError) {


        // Inventory lots might not exist, don't fail the operation
      } // Determine stock status
      const minStockLevel = Math.max(1, parseInt(product.min_stock_level) || 5);
      let stockStatus = 'in_stock';
      let alertLevel = 'normal';

      if (newStock === 0) {
        stockStatus = 'out_of_stock';
        alertLevel = 'critical';
      } else if (newStock <= minStockLevel) {
        stockStatus = 'low_stock';
        alertLevel = newStock <= minStockLevel * 0.5 ? 'high' : 'medium';
      }

      return {
        success: true,
        product_id: pId,
        product_name: product.name,
        previous_stock: currentStock,
        new_stock: newStock,
        quantity_change: qtyChange,
        stock_status: stockStatus,
        alert_level: alertLevel,
        movement_id: movementResult && movementResult[0] ? movementResult[0].id : null,
        updated_at: timestamp,
        message: `Stock updated successfully. New quantity: ${newStock}`
      };

    } catch (transactionError) {
      throw new Error('Failed to complete stock update transaction');
    }

  } catch (error) {
    // Production error handling
    if (error.message.includes('required') ||
    error.message.includes('not found') ||
    error.message.includes('Insufficient') ||
    error.message.includes('Cannot update')) {
      throw new Error(error.message);
    }

    throw new Error('Failed to update stock. Please try again.');
  }
}