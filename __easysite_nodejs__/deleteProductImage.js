
function deleteProductImage(imageId) {
  try {
    // Input validation
    if (!imageId || isNaN(parseInt(imageId))) {
      throw new Error('Valid image ID is required');
    }

    const imgId = parseInt(imageId);

    // Get image details before deletion
    const getImageQuery = `
      SELECT 
        pi.id, 
        pi.product_id, 
        pi.image_url, 
        pi.sort_order,
        pi.alt_text,
        p.name as product_name,
        p.is_active
      FROM product_images pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.id = $1
    `;

    let imageResult;
    try {
      imageResult = window.ezsite.db.query(getImageQuery, [imgId]);
    } catch (dbError) {
      throw new Error('Database query failed');
    }

    if (!imageResult || imageResult.length === 0) {
      throw new Error('Image not found');
    }

    const image = imageResult[0];

    // Validate product exists and is accessible
    if (!image.product_id) {
      throw new Error('Invalid image - no associated product');
    }

    // Check if this is the last image for the product
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM product_images 
      WHERE product_id = $1
    `;

    const countResult = window.ezsite.db.query(countQuery, [image.product_id]);
    const imageCount = parseInt(countResult[0]?.count || 0);

    // Allow deletion even if it's the last image (product can exist without images)

    // Start transaction-like operations
    try {
      // 1. Delete the image record
      const deleteQuery = `
        DELETE FROM product_images 
        WHERE id = $1 
        RETURNING id, image_url
      `;

      const deleteResult = window.ezsite.db.query(deleteQuery, [imgId]);

      if (!deleteResult || deleteResult.length === 0) {
        throw new Error('Failed to delete image record');
      }

      // 2. Reorder remaining images to fill the gap
      const reorderQuery = `
        UPDATE product_images 
        SET sort_order = sort_order - 1 
        WHERE product_id = $1 AND sort_order > $2
      `;

      window.ezsite.db.query(reorderQuery, [image.product_id, image.sort_order]);

      // 3. Update product's updated_at timestamp
      const updateProductQuery = `
        UPDATE products 
        SET updated_at = $1 
        WHERE id = $2
      `;

      window.ezsite.db.query(updateProductQuery, [new Date().toISOString(), image.product_id]);

      // Prepare response
      const response = {
        success: true,
        deleted_image_id: imgId,
        product_id: image.product_id,
        product_name: image.product_name || 'Unknown Product',
        deleted_image_url: image.image_url,
        remaining_images: Math.max(0, imageCount - 1),
        message: 'Image deleted successfully'
      };

      // Add warning if this was the last image
      if (imageCount === 1) {
        response.warning = 'This was the last image for the product';
      }

      return response;

    } catch (transactionError) {
      throw new Error('Failed to complete image deletion');
    }

  } catch (error) {
    // Production error handling
    if (error.message.includes('required') ||
    error.message.includes('not found') ||
    error.message.includes('Invalid image')) {
      throw new Error(error.message);
    }

    throw new Error('Failed to delete image. Please try again.');
  }
}