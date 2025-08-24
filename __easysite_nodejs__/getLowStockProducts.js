
function getLowStockProducts(filters = {}) {
  try {
    // Input validation and sanitization
    if (typeof filters !== 'object' || filters === null) {
      filters = {};
    }

    // Build optimized query for low stock products
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
        p.created_at,
        p.updated_at,
        c.name as category_name,
        c.id as category_id,
        CASE 
          WHEN p.current_stock IS NULL OR p.current_stock = 0 THEN 'out_of_stock'
          WHEN p.current_stock <= COALESCE(p.min_stock_level, 5) THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status,
        COALESCE(p.current_stock, 0) as stock_level,
        COALESCE(p.min_stock_level, 5) as threshold_level
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true 
        AND p.is_trackable = true
        AND (p.current_stock IS NULL OR p.current_stock <= COALESCE(p.min_stock_level, 5))
    `;

    const params = [];
    let paramIndex = 1;

    // Add search filter with validation
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      const searchTerm = filters.search.trim().slice(0, 100);
      query += ` AND (
        LOWER(p.name) LIKE LOWER($${paramIndex}) OR 
        LOWER(p.sku) LIKE LOWER($${paramIndex}) OR
        LOWER(p.barcode) LIKE LOWER($${paramIndex}) OR
        LOWER(p.brand) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    // Add category filter with validation
    if (filters.category_id && !isNaN(parseInt(filters.category_id))) {
      const categoryId = parseInt(filters.category_id);
      if (categoryId > 0) {
        query += ` AND p.category_id = $${paramIndex}`;
        params.push(categoryId);
        paramIndex++;
      }
    }

    // Add brand filter with validation
    if (filters.brand && typeof filters.brand === 'string' && filters.brand.trim()) {
      const brandTerm = filters.brand.trim().slice(0, 50);
      query += ` AND LOWER(p.brand) LIKE LOWER($${paramIndex})`;
      params.push(`%${brandTerm}%`);
      paramIndex++;
    }

    // Add stock status filter
    if (filters.stock_status && typeof filters.stock_status === 'string') {
      const status = filters.stock_status.trim().toLowerCase();
      if (status === 'out_of_stock') {
        query += ` AND (p.current_stock IS NULL OR p.current_stock = 0)`;
      } else if (status === 'critical') {
        // Only show products with stock < 50% of minimum
        query += ` AND p.current_stock IS NOT NULL AND p.current_stock > 0 AND p.current_stock < (COALESCE(p.min_stock_level, 5) * 0.5)`;
      }
    }

    // Order by criticality: out of stock first, then by percentage of minimum stock
    query += ` ORDER BY 
      CASE 
        WHEN p.current_stock IS NULL OR p.current_stock = 0 THEN 0
        ELSE COALESCE(p.current_stock, 0)::FLOAT / GREATEST(COALESCE(p.min_stock_level, 5), 1)
      END ASC,
      p.name ASC
    `;

    // Add pagination with reasonable limits
    const limit = Math.min(Math.max(1, parseInt(filters.limit) || 100), 1000);
    const offset = Math.max(0, parseInt(filters.offset) || 0);

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit);
    params.push(offset);

    // Execute query with error handling
    let result;
    try {
      result = window.ezsite.db.query(query, params);
    } catch (dbError) {
      throw new Error('Database query failed. Please try again.');
    }

    if (!result || !Array.isArray(result)) {
      return [];
    }

    // Process and validate results
    const lowStockProducts = result.
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
            // Validate each URL
            imageUrls = imageUrls.filter((url) => typeof url === 'string' && url.trim());
          } catch (parseError) {
            imageUrls = [];
          }
        }

        // Safely convert and validate numeric values
        const currentStock = Math.max(0, parseInt(product.current_stock) || 0);
        const minStockLevel = Math.max(1, parseInt(product.min_stock_level) || 5);
        const maxStockLevel = Math.max(minStockLevel, parseInt(product.max_stock_level) || 20);

        // Handle pricing with validation
        let sellingPrice = Math.max(0, parseFloat(product.selling_price) || 0);
        let costPrice = Math.max(0, parseFloat(product.cost_price) || 0);

        // Fallback to cents fields if needed
        if (sellingPrice === 0 && product.price_cents) {
          sellingPrice = Math.max(0, Math.round((parseInt(product.price_cents) || 0) / 100 * 100) / 100);
        }
        if (costPrice === 0 && product.cost_cents) {
          costPrice = Math.max(0, Math.round((parseInt(product.cost_cents) || 0) / 100 * 100) / 100);
        }

        // Calculate stock urgency metrics
        const stockPercentage = minStockLevel > 0 ? currentStock / minStockLevel * 100 : 0;
        const daysRemaining = currentStock > 0 ? Math.floor(currentStock / Math.max(1, minStockLevel / 7)) : 0;

        // Validate and sanitize text fields
        const sanitizeText = (text, maxLength = 255) => {
          return (text || '').toString().trim().slice(0, maxLength);
        };

        return {
          id: parseInt(product.id) || 0,
          name: sanitizeText(product.name, 100),
          description: sanitizeText(product.description, 500),
          brand: sanitizeText(product.brand, 100),
          category_id: parseInt(product.category_id) || null,
          category_name: sanitizeText(product.category_name, 100),
          sku: sanitizeText(product.sku, 50),
          barcode: sanitizeText(product.barcode, 50),
          unit: sanitizeText(product.unit || 'pcs', 20),

          // Stock information
          current_stock: currentStock,
          total_stock: currentStock, // For compatibility
          min_stock_level: minStockLevel,
          max_stock_level: maxStockLevel,
          stock_status: product.stock_status || 'unknown',

          // Stock analysis
          stock_percentage: Math.round(stockPercentage * 100) / 100,
          days_remaining: daysRemaining,
          urgency_level: currentStock === 0 ? 'critical' :
          stockPercentage < 25 ? 'high' :
          stockPercentage < 50 ? 'medium' : 'low',

          // Pricing
          selling_price: sellingPrice,
          price: sellingPrice, // For compatibility
          cost_price: costPrice,
          cost: costPrice, // For compatibility
          cost_cents: Math.round(costPrice * 100),
          price_cents: Math.round(sellingPrice * 100),

          // Other attributes
          tax_rate: Math.max(0, Math.min(100, parseFloat(product.tax_rate) || 0)),
          images: imageUrls,
          image_urls: imageUrls, // For compatibility
          is_active: Boolean(product.is_active),
          is_trackable: Boolean(product.is_trackable),

          // Timestamps
          created_at: product.created_at,
          updated_at: product.updated_at
        };
      } catch (formatError) {
        return null;
      }
    }).
    filter((product) => product !== null);

    // Add summary statistics
    const summary = {
      total_count: lowStockProducts.length,
      out_of_stock_count: lowStockProducts.filter((p) => p.current_stock === 0).length,
      critical_count: lowStockProducts.filter((p) => p.urgency_level === 'critical').length,
      high_urgency_count: lowStockProducts.filter((p) => p.urgency_level === 'high').length,
      medium_urgency_count: lowStockProducts.filter((p) => p.urgency_level === 'medium').length
    };

    return {
      products: lowStockProducts,
      summary,
      filters_applied: {
        search: filters.search ? filters.search.trim() : null,
        category_id: filters.category_id ? parseInt(filters.category_id) : null,
        brand: filters.brand ? filters.brand.trim() : null,
        stock_status: filters.stock_status || null,
        limit,
        offset
      }
    };

  } catch (error) {
    // Production error handling - don't expose internal details
    throw new Error('Failed to retrieve low stock products. Please try again.');
  }
}