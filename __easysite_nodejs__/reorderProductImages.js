
async function reorderProductImages(productId, imageOrder) {
  try {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    if (!Array.isArray(imageOrder)) {
      throw new Error('Image order must be an array');
    }

    // Validate that all images belong to the product
    const existingImagesQuery = `
      SELECT id FROM product_images WHERE product_id = $1
    `;
    const existingImages = await window.ezsite.db.query(existingImagesQuery, [parseInt(productId)]);
    const existingIds = existingImages.map((img) => img.id);

    for (const image of imageOrder) {
      if (!existingIds.includes(image.id)) {
        throw new Error(`Image ${image.id} does not belong to product ${productId}`);
      }
    }

    // Begin transaction
    await window.ezsite.db.query('BEGIN');

    try {
      // Update sort orders
      for (let i = 0; i < imageOrder.length; i++) {
        const updateQuery = `
          UPDATE product_images 
          SET sort_order = $1 
          WHERE id = $2
        `;
        await window.ezsite.db.query(updateQuery, [i, imageOrder[i].id]);
      }

      await window.ezsite.db.query('COMMIT');

      return {
        message: 'Images reordered successfully',
        reorderedCount: imageOrder.length
      };

    } catch (error) {
      await window.ezsite.db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Reorder product images error:', error);
    throw new Error(`Failed to reorder images: ${error.message}`);
  }
}