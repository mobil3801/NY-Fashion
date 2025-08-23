
function getProducts(filters = {}) {
  try {
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
        p.size,
        p.color,
        p.weight,
        p.bn_name,
        p.bn_description,
        p.created_at,
        p.updated_at,
        c.name as category_name,
        c.id as category_id
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Apply active filter by default unless specifically requesting inactive products
    if (filters.include_inactive !== true) {
      query += ` AND p.is_active = true`;
    }

    // Apply search filters
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      query += ` AND (
        LOWER(p.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(p.description) LIKE LOWER($${paramIndex}) OR
        LOWER(p.sku) LIKE LOWER($${paramIndex}) OR
        LOWER(p.barcode) LIKE LOWER($${paramIndex}) OR
        LOWER(p.brand) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    // Category filter
    if (filters.category_id && !isNaN(parseInt(filters.category_id))) {
      query += ` AND p.category_id = $${paramIndex}`;
      params.push(parseInt(filters.category_id));
      paramIndex++;
    }

    // Brand filter
    if (filters.brand && typeof filters.brand === 'string' && filters.brand.trim()) {
      query += ` AND LOWER(p.brand) LIKE LOWER($${paramIndex})`;
      params.push(`%${filters.brand.trim()}%`);
      paramIndex++;
    }

    // Price range filters
    if (filters.min_price && !isNaN(parseFloat(filters.min_price))) {
      query += ` AND (p.selling_price >= $${paramIndex} OR p.price_cents >= $${paramIndex + 1})`;
      params.push(parseFloat(filters.min_price));
      params.push(parseFloat(filters.min_price) * 100);
      paramIndex += 2;
    }

    if (filters.max_price && !isNaN(parseFloat(filters.max_price))) {
      query += ` AND (p.selling_price <= $${paramIndex} OR p.price_cents <= $${paramIndex + 1})`;
      params.push(parseFloat(filters.max_price));
      params.push(parseFloat(filters.max_price) * 100);
      paramIndex += 2;
    }

    // Stock level filters
    if (filters.low_stock === true) {
      query += ` AND (p.current_stock IS NULL OR p.current_stock <= COALESCE(p.min_stock_level, 5))`;
    }

    if (filters.out_of_stock === true) {
      query += ` AND (p.current_stock IS NULL OR p.current_stock = 0)`;
    }

    // Add ordering with validation
    const orderBy = filters.order_by || 'name';
    const orderDir = filters.order_dir === 'desc' ? 'DESC' : 'ASC';

    // Validate order_by field to prevent SQL injection
    const validOrderFields = ['name', 'brand', 'selling_price', 'price_cents', 'current_stock', 'created_at', 'updated_at'];
    if (validOrderFields.includes(orderBy)) {
      query += ` ORDER BY p.${orderBy} ${orderDir}`;
    } else {
      query += ` ORDER BY p.name ASC`;
    }

    // Add pagination if specified
    if (filters.limit && !isNaN(parseInt(filters.limit))) {
      const limit = Math.min(parseInt(filters.limit), 1000); // Reasonable limit
      const offset = Math.max(0, parseInt(filters.offset) || 0);

      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit);
      params.push(offset);
      paramIndex += 2;
    }

    // Execute the query with error handling
    let result;
    try {
      result = window.ezsite.db.query(query, params);
    } catch (dbError) {
      console.error('Database query error in getProducts:', dbError);
      throw new Error('Database connection failed. Please check your connection and try again.');
    }

    if (!result) {
      return [];
    }

    // Format and validate the results
    const products = result.
    filter((product) => product && typeof product === 'object').
    map((product) => {
      try {
        // Parse image URLs safely
        let imageUrls = [];
        if (product.image_urls) {
          try {
            imageUrls = Array.isArray(product.image_urls) ?
            product.image_urls :
            JSON.parse(product.image_urls || '[]');
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

        // Fallback to cents fields if needed and convert
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
          size: (product.size || '').toString().trim(),
          color: (product.color || '').toString().trim(),
          weight: parseFloat(product.weight) || 0,

          // Multilingual support
          name_bn: (product.bn_name || '').toString().trim(),
          bn_name: (product.bn_name || '').toString().trim(), // For backwards compatibility
          description_bn: (product.bn_description || '').toString().trim(),
          bn_description: (product.bn_description || '').toString().trim(), // For backwards compatibility

          // Stock information (multiple field names for compatibility)
          current_stock: currentStock,
          total_stock: currentStock, // For frontend compatibility
          min_stock_level: minStockLevel,
          max_stock_level: maxStockLevel,

          // Pricing (multiple field names for compatibility)
          selling_price: sellingPrice,
          price: sellingPrice, // For frontend compatibility
          cost_price: costPrice,
          cost: costPrice, // For frontend compatibility
          costCents: parseInt(product.cost_cents) || Math.round(costPrice * 100),
          priceCents: parseInt(product.price_cents) || Math.round(sellingPrice * 100),
          cost_cents: parseInt(product.cost_cents) || Math.round(costPrice * 100),
          price_cents: parseInt(product.price_cents) || Math.round(sellingPrice * 100),

          // Other attributes
          tax_rate: parseFloat(product.tax_rate) || 0,
          taxExempt: Boolean(product.tax_rate === 0), // For compatibility
          images: imageUrls,
          image_urls: imageUrls,
          is_active: Boolean(product.is_active),
          is_trackable: Boolean(product.is_trackable),

          // Timestamps
          created_at: product.created_at,
          updated_at: product.updated_at,

          // Calculate stock status for frontend
          stock_status: currentStock === 0 ? 'out_of_stock' :
          currentStock <= minStockLevel ? 'low_stock' : 'in_stock'
        };
      } catch (formatError) {
        console.error('Error formatting product data:', product.id, formatError);
        return null;
      }
    }).
    filter((product) => product !== null); // Remove any failed formatting attempts

    return products;

  } catch (error) {
    console.error('getProducts error:', error);

    // Provide user-friendly error messages
    let userMessage = 'Failed to fetch products.';
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