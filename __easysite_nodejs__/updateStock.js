
function updateStock(productId, variantId, quantity, movementType, referenceId) {
  // Mock stock update - in real implementation would update database

  const stockMovement = {
    id: `move-${Date.now()}`,
    productId,
    variantId,
    movementType, // 'sale', 'return', 'adjustment', 'restock'
    quantity: Math.abs(quantity),
    referenceId,
    referenceType: movementType === 'sale' ? 'invoice' : movementType,
    createdBy: 'system', // In real app, would be current user
    createdAt: new Date().toISOString()
  };

  // Calculate new stock level
  const currentStock = 100; // Mock current stock
  const newStock = movementType === 'sale' ? currentStock - quantity : currentStock + quantity;

  if (newStock < 0 && movementType === 'sale') {
    throw new Error(`Insufficient stock. Available: ${currentStock}, Requested: ${quantity}`);
  }

  return {
    stockMovement,
    newStock,
    previousStock: currentStock
  };
}