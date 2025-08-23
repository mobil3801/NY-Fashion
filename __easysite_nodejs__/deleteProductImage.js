
function deleteProductImage(imageId) {
  try {
    if (!imageId) {
      throw new Error('Image ID is required');
    }

    // Get image details before deletion
    const getQuery = `
      SELECT id, product_id, image_url, sort_order 
      FROM product_images 
      WHERE id = $1
    `;
    
    const imageResult = window.ezsite.db.query(getQuery, [parseInt(imageId)]);
    
    if (!imageResult || imageResult.length === 0) {
      throw new Error('Image not found');
    }

    const image = imageResult[0];

    // Delete the image record
    const deleteQuery = `DELETE FROM product_images WHERE id = $1`;
    const deleteResult = window.ezsite.db.query(deleteQuery, [parseInt(imageId)]);

    // Reorder remaining images to fill the gap
    const reorderQuery = `
      UPDATE product_images 
      SET sort_order = sort_order - 1 
      WHERE product_id = $1 AND sort_order > $2
    `;
    
    window.ezsite.db.query(reorderQuery, [image.product_id, image.sort_order]);

    return {
      message: 'Image deleted successfully',
      deletedImageId: parseInt(imageId)
    };

  } catch (error) {
    console.error('Delete product image error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}
