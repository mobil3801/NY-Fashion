
function getProductImages(productId) {
  try {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const query = `
      SELECT id, product_id, image_url, alt_text, sort_order, file_size, mime_type, uploaded_at
      FROM product_images 
      WHERE product_id = $1 
      ORDER BY sort_order ASC
    `;

    const result = window.ezsite.db.query(query, [parseInt(productId)]);

    return result || [];

  } catch (error) {
    console.error('Get product images error:', error);
    throw new Error(`Failed to get product images: ${error.message}`);
  }
}