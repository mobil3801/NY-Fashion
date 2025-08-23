
function reorderProductImages(productId, imageOrders) {
  try {
    if (!productId || !imageOrders || !Array.isArray(imageOrders)) {
      throw new Error('Product ID and image orders array are required');
    }

    // Start transaction-like updates
    for (let i = 0; i < imageOrders.length; i++) {
      const { imageId, sortOrder } = imageOrders[i];
      
      const updateQuery = `
        UPDATE product_images 
        SET sort_order = $1 
        WHERE id = $2 AND product_id = $3
      `;
      
      window.ezsite.db.query(updateQuery, [sortOrder, parseInt(imageId), parseInt(productId)]);
    }

    return {
      message: 'Image order updated successfully',
      updatedCount: imageOrders.length
    };

  } catch (error) {
    console.error('Reorder product images error:', error);
    throw new Error(`Failed to reorder images: ${error.message}`);
  }
}
