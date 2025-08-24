
function reorderProductImages(productId, imageOrders) {
  try {
    // Input validation
    if (!productId || isNaN(parseInt(productId))) {
      throw new Error('Valid product ID is required');
    }

    if (!imageOrders || !Array.isArray(imageOrders)) {
      throw new Error('Image orders array is required');
    }

    if (imageOrders.length === 0) {
      throw new Error('No image orders provided');
    }

    const pId = parseInt(productId);

    // Validate product exists
    const productCheckQuery = `
      SELECT id, name, is_active 
      FROM products 
      WHERE id = $1
    `;

    let productResult;
    try {
      productResult = window.ezsite.db.query(productCheckQuery, [pId]);
    } catch (dbError) {
      throw new Error('Database query failed');
    }

    if (!productResult || productResult.length === 0) {
      throw new Error('Product not found');
    }

    // Get current images for validation
    const currentImagesQuery = `
      SELECT id, sort_order 
      FROM product_images 
      WHERE product_id = $1
      ORDER BY sort_order ASC
    `;

    const currentImages = window.ezsite.db.query(currentImagesQuery, [pId]);
    const currentImageIds = new Set(currentImages.map((img) => parseInt(img.id)));

    // Validate image orders input
    const validOrders = [];
    const errors = [];

    for (let i = 0; i < imageOrders.length; i++) {
      const order = imageOrders[i];

      if (!order || typeof order !== 'object') {
        errors.push(`Order ${i + 1}: Invalid order object`);
        continue;
      }

      const { imageId, sortOrder } = order;

      if (!imageId || isNaN(parseInt(imageId))) {
        errors.push(`Order ${i + 1}: Invalid image ID`);
        continue;
      }

      if (sortOrder === undefined || sortOrder === null || isNaN(parseInt(sortOrder))) {
        errors.push(`Order ${i + 1}: Invalid sort order`);
        continue;
      }

      const imgId = parseInt(imageId);
      const newSortOrder = Math.max(0, parseInt(sortOrder));

      // Check if image belongs to this product
      if (!currentImageIds.has(imgId)) {
        errors.push(`Order ${i + 1}: Image ${imgId} does not belong to product ${pId}`);
        continue;
      }

      // Check for duplicate image IDs in the request
      if (validOrders.some((vo) => vo.imageId === imgId)) {
        errors.push(`Order ${i + 1}: Duplicate image ID ${imgId}`);
        continue;
      }

      validOrders.push({
        imageId: imgId,
        sortOrder: newSortOrder
      });
    }

    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join('; ')}`);
    }

    if (validOrders.length === 0) {
      throw new Error('No valid image orders to process');
    }

    // Sort orders to ensure consistency
    validOrders.sort((a, b) => a.sortOrder - b.sortOrder);

    // Reassign sort orders to ensure they're sequential starting from 0
    const finalOrders = validOrders.map((order, index) => ({
      ...order,
      sortOrder: index
    }));

    // Update database
    const updatedCount = 0;
    const updateErrors = [];

    try {
      for (const order of finalOrders) {
        const updateQuery = `
          UPDATE product_images 
          SET sort_order = $1 
          WHERE id = $2 AND product_id = $3
        `;

        try {
          const updateResult = window.ezsite.db.query(updateQuery, [
          order.sortOrder,
          order.imageId,
          pId]
          );

          // Note: Some DB adapters might not return affected rows count
          // We'll assume success if no error is thrown
        } catch (updateError) {
          updateErrors.push(`Failed to update image ${order.imageId}: ${updateError.message}`);
        }
      }

      if (updateErrors.length > 0) {
        throw new Error(`Update errors: ${updateErrors.join('; ')}`);
      }

      // Update product's updated_at timestamp
      const updateProductQuery = `
        UPDATE products 
        SET updated_at = $1 
        WHERE id = $2
      `;

      window.ezsite.db.query(updateProductQuery, [new Date().toISOString(), pId]);

      // Get updated images to return
      const finalImagesQuery = `
        SELECT id, sort_order, alt_text, image_url
        FROM product_images 
        WHERE product_id = $1 
        ORDER BY sort_order ASC
      `;

      const updatedImages = window.ezsite.db.query(finalImagesQuery, [pId]);

      return {
        success: true,
        product_id: pId,
        updated_count: finalOrders.length,
        total_images: updatedImages.length,
        images: updatedImages.map((img) => ({
          id: parseInt(img.id),
          sort_order: parseInt(img.sort_order),
          alt_text: img.alt_text,
          image_url: img.image_url
        })),
        message: `Successfully reordered ${finalOrders.length} image(s)`
      };

    } catch (transactionError) {
      throw new Error('Failed to complete image reordering');
    }

  } catch (error) {
    // Production error handling
    if (error.message.includes('required') ||
    error.message.includes('not found') ||
    error.message.includes('Validation errors') ||
    error.message.includes('No valid image orders')) {
      throw new Error(error.message);
    }

    throw new Error('Failed to reorder images. Please try again.');
  }
}