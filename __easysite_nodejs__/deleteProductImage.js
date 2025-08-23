
async function deleteProductImage(imageId) {
  try {
    if (!imageId) {
      throw new Error('Image ID is required');
    }

    // Get image record first
    const selectQuery = `
      SELECT id, product_id, image_url, file_id, sort_order 
      FROM product_images 
      WHERE id = $1
    `;
    const imageResult = await window.ezsite.db.query(selectQuery, [parseInt(imageId)]);

    if (!imageResult || imageResult.length === 0) {
      throw new Error('Image not found');
    }

    const image = imageResult[0];

    // Delete from storage if file_id exists
    if (image.file_id) {
      try {






        // Note: EasySite storage doesn't have a delete API yet, but we prepare for it
        // await window.ezsite.apis.deleteFile(image.file_id);
      } catch (error) {console.warn('Could not delete file from storage:', error.message); // Continue with database deletion even if storage deletion fails
      }} // Delete from database
    const deleteQuery = `DELETE FROM product_images WHERE id = $1`;await window.ezsite.db.query(deleteQuery, [parseInt(imageId)]);

    // Reorder remaining images
    const reorderQuery = `
      UPDATE product_images 
      SET sort_order = sort_order - 1 
      WHERE product_id = $1 AND sort_order > $2
    `;
    await window.ezsite.db.query(reorderQuery, [image.product_id, image.sort_order]);

    return {
      message: 'Image deleted successfully',
      deletedImageId: imageId
    };

  } catch (error) {
    console.error('Delete product image error:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}