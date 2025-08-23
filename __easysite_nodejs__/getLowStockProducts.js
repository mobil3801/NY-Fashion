
function getLowStockProducts(filters = {}) {
  try {
    // Build the query to get products with low stock levels
    let query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.brand,
        p.cost_price,
        p.selling_price,
        p.cost_cents,
        p.price_cents,
        p.tax_rate,
        p.barcode,
        p.sku,
        p.image_urls,
        p.unit,
        p.current_stock,
        p.min_stock_level,
        p.max_stock_level,
        p.is_active,
        p.is_trackable,
        c.name as category_name,
        c.id as category_id
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true 
        AND p.is_trackable = true
        AND (p.current_stock IS NULL OR p.current_stock <= COALESCE(p.min_stock_level, 5))
    `;

    const params = [];
    let paramIndex = 1;

    // Add search filter if provided
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      query += ` AND (
        LOWER(p.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(p.sku) LIKE LOWER($${paramIndex}) OR
        LOWER(p.barcode) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    // Add category filter if provided
    if (filters.category_id && !isNaN(parseInt(filters.category_id))) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(parseInt(filters.category_id));
      paramIndex++;
    }

    // Order by criticality (out of stock first, then by stock level)
    query += ` ORDER BY 
      CASE 
        WHEN p.current_stock IS NULL OR p.current_stock = 0 THEN 0
        ELSE p.current_stock
      END ASC,
      p.name ASC`;

    // Limit results for performance
    const limit = Math.min(parseInt(filters.limit) || 100, 500);
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);

    // Execute the query
    let result;
    try {
      result = window.ezsite.db.query(query, params);
    } catch (dbError) {
      console.error('Database query error in getLowStockProducts:', dbError);
      throw new Error('Database connection failed. Please check your connection and try again.');
    }

    if (!result) {
      return [];
    }

    // Validate and format the results
    const lowStockProducts = result
      .filter(product => product && typeof product === 'object')
      .map((product) => {
        try {
          // Parse image URLs safely
          let imageUrls = [];
          if (product.image_urls) {
            try {
              imageUrls = Array.isArray(product.image_urls) 
                ? product.image_urls 
                : JSON.parse(product.image_urls || '[]');
            } catch (parseError) {
              console.warn('Failed to parse image URLs for product:', product.id, parseError);
              imageUrls = [];
            }
          }

          // Safely convert numeric values
          const currentStock = Math.max(0, parseInt(product.current_stock) || 0);
          const minStockLevel = Math.max(1, parseInt(product.min_stock_level) || 5);
          const maxStockLevel = Math.max(minStockLevel + 1, parseInt(product.max_stock_level) || 20);
          
          // Handle pricing - prefer new fields over legacy cent fields
          let sellingPrice = parseFloat(product.selling_price) || 0;
          let costPrice = parseFloat(product.cost_price) || 0;
          
          // Fallback to cents fields if needed
          if (sellingPrice === 0 && product.price_cents) {
            sellingPrice = Math.round((parseInt(product.price_cents) || 0) / 100 * 100) / 100;
          }
          if (costPrice === 0 && product.cost_cents) {
            costPrice = Math.round((parseInt(product.cost_cents) || 0) / 100 * 100) / 100;
          }

          return {
            id: parseInt(product.id) || 0,
            name: (product.name || '').toString().trim(),
            description: (product.description || '').toString().trim(),
            brand: (product.brand || '').toString().trim(),
            category_id: parseInt(product.category_id) || null,
            category_name: (product.category_name || '').toString().trim(),
            sku: (product.sku || '').toString().trim(),
            barcode: (product.barcode || '').toString().trim(),
            unit: (product.unit || 'pcs').toString().trim(),

            // Stock information (matching frontend expectations)
            total_stock: currentStock,
            current_stock: currentStock,
            min_stock_level: minStockLevel,
            max_stock_level: maxStockLevel,

            // Pricing (matching frontend expectations)
            selling_price: sellingPrice,
            cost_price: costPrice,
            cost_cents: parseInt(product.cost_cents) || Math.round(costPrice * 100),
            price_cents: parseInt(product.price_cents) || Math.round(sellingPrice * 100),

            // Other attributes
            tax_rate: parseFloat(product.tax_rate) || 0,
            images: imageUrls,
            image_urls: imageUrls, // For backwards compatibility
            is_active: Boolean(product.is_active),
            is_trackable: Boolean(product.is_trackable)
          };
        } catch (formatError) {
          console.error('Error formatting product data:', product.id, formatError);
          return null;
        }
      })
      .filter(product => product !== null); // Remove any failed formatting attempts

    return lowStockProducts;

  } catch (error) {
    console.error('getLowStockProducts error:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to fetch low stock products.';
    if (error.message.includes('Database connection')) {
      userMessage = 'Database connection failed. Please check your internet connection and try again.';
    } else if (error.message.includes('query')) {
      userMessage = 'Database query failed. Please try again or contact support if the issue persists.';
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      userMessage = 'Network error occurred. Please check your connection and try again.';
    }
    
    throw new Error(userMessage);
  }
}
