
function getProductImages(productId) {
  try {
    // Input validation
    if (!productId || isNaN(parseInt(productId))) {
      throw new Error('Valid product ID is required');
    }

    const pId = parseInt(productId);

    // Verify product exists
    const productCheckQuery = `
      SELECT id, name 
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

    // Get product images
    const imagesQuery = `
      SELECT 
        id, 
        product_id, 
        image_url, 
        alt_text, 
        sort_order, 
        file_size, 
        mime_type, 
        uploaded_at
      FROM product_images 
      WHERE product_id = $1 
      ORDER BY sort_order ASC, uploaded_at ASC
    `;

    let result;
    try {
      result = window.ezsite.db.query(imagesQuery, [pId]);
    } catch (dbError) {
      throw new Error('Database query failed');
    }

    if (!result || !Array.isArray(result)) {
      return [];
    }

    // Process and validate results
    const images = result
      .filter(image => image && typeof image === 'object')
      .map(image => {
        try {
          // Sanitize and validate fields
          const sanitizeText = (text, maxLength = 255) => {
            return (text || '').toString().trim().slice(0, maxLength);
          };

          const sanitizedImage = {
            id: parseInt(image.id) || 0,
            product_id: parseInt(image.product_id) || 0,
            image_url: sanitizeText(image.image_url, 500),
            alt_text: sanitizeText(image.alt_text, 200),
            sort_order: Math.max(0, parseInt(image.sort_order) || 0),
            file_size: Math.max(0, parseInt(image.file_size) || 0),
            mime_type: sanitizeText(image.mime_type, 50),
            uploaded_at: image.uploaded_at
          };

          // Validate required fields
          if (!sanitizedImage.image_url) {
            return null;
          }

          // Add calculated fields
          sanitizedImage.file_size_formatted = formatFileSize(sanitizedImage.file_size);
          sanitizedImage.is_primary = sanitizedImage.sort_order === 0;

          return sanitizedImage;

        } catch (formatError) {
          return null;
        }
      })
      .filter(image => image !== null);

    return images;

  } catch (error) {
    // Production error handling
    if (error.message.includes('required') || error.message.includes('not found')) {
      throw new Error(error.message);
    }
    
    throw new Error('Failed to retrieve product images. Please try again.');
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  
  return `${size} ${sizes[i]}`;
}
