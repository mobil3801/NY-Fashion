
async function getProductImages(productId) {
  try {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    const query = `
      SELECT 
        id, 
        product_id, 
        image_url, 
        alt_text, 
        sort_order, 
        file_size, 
        mime_type, 
        file_id,
        uploaded_at
      FROM product_images 
      WHERE product_id = $1 
      ORDER BY sort_order ASC
    `;

    const result = await window.ezsite.db.query(query, [parseInt(productId)]);

    return {
      images: result || [],
      count: result?.length || 0
    };

  } catch (error) {
    console.error('Get product images error:', error);
    throw new Error(`Failed to get product images: ${error.message}`);
  }
}