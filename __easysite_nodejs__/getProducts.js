
function getProducts(filters = {}) {
  try {
    // Input validation and sanitization
    if (typeof filters !== 'object' || filters === null) {
      filters = {};
    }

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

    // Apply search filters with validation
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      const searchTerm = filters.search.trim().slice(0, 100); // Limit length
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

    // Category filter with validation
    if (filters.category_id && !isNaN(parseInt(filters.category_id))) {
      const categoryId = parseInt(filters.category_id);
      if (categoryId > 0) {
        query += ` AND p.category_id = $${paramIndex}`;
        params.push(categoryId);
        paramIndex++;
      }
    }

    // Brand filter with validation
    if (filters.brand && typeof filters.brand === 'string' && filters.brand.trim()) {
      const brandTerm = filters.brand.trim().slice(0, 50);
      query += ` AND LOWER(p.brand) LIKE LOWER($${paramIndex})`;
      params.push(`%${brandTerm}%`);
      paramIndex++;
    }

    // Price range filters with validation
    if (filters.min_price && !isNaN(parseFloat(filters.min_price))) {
      const minPrice = Math.max(0, parseFloat(filters.min_price));
      query += ` AND (p.selling_price >= $${paramIndex} OR p.price_cents >= $${paramIndex + 1})`;
      params.push(minPrice);
      params.push(Math.round(minPrice * 100));
      paramIndex += 2;
    }

    if (filters.max_price && !isNaN(parseFloat(filters.max_price))) {
      const maxPrice = Math.max(0, parseFloat(filters.max_price));
      query += ` AND (p.selling_price <= $${paramIndex} OR p.price_cents <= $${paramIndex + 1})`;
      params.push(maxPrice);
      params.push(Math.round(maxPrice * 100));
      paramIndex += 2;
    }

    // Stock level filters
    if (filters.low_stock === true) {
      query += ` AND p.is_trackable = true AND (p.current_stock IS NULL OR p.current_stock <= COALESCE(p.min_stock_level, 5))`;
    }

    if (filters.out_of_stock === true) {
      query += ` AND p.is_trackable = true AND (p.current_stock IS NULL OR p.current_stock = 0)`;
    }

    // Add ordering with validation
    const validOrderFields = ['name', 'brand', 'selling_price', 'price_cents', 'current_stock', 'created_at', 'updated_at'];
    const orderBy = validOrderFields.includes(filters.order_by) ? filters.order_by : 'name';
    const orderDir = filters.order_dir === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY p.${orderBy} ${orderDir}`;

    // Add pagination with limits
    if (filters.limit && !isNaN(parseInt(filters.limit))) {
      const limit = Math.min(Math.max(1, parseInt(filters.limit)), 1000); // Between 1 and 1000
      const offset = Math.max(0, parseInt(filters.offset) || 0);

      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit);
      params.push(offset);
    }

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
    const products = result
      .filter(product => product && typeof product === 'object')
      .map(product => {
        try {
          // Parse image URLs safely
          let imageUrls = [];
          if (product.image_urls) {
            try {
              imageUrls = Array.isArray(product.image_urls) 
                ? product.image_urls 
                : JSON.parse(product.image_urls || '[]');
              // Validate each URL
              imageUrls = imageUrls.filter(url => typeof url === 'string' && url.trim());
            } catch (parseError) {
              imageUrls = [];
            }
          }

          // Safely convert numeric values with validation
          const currentStock = Math.max(0, parseInt(product.current_stock) || 0);
          const minStockLevel = Math.max(0, parseInt(product.min_stock_level) || 5);
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

          // Validate and sanitize text fields
          const sanitizeText = (text, maxLength = 255) => {
            return (text || '').toString().trim().slice(0, maxLength);
          };

          return {
            id: parseInt(product.id) || 0,
            name: sanitizeText(product.name, 100),
            description: sanitizeText(product.description, 1000),
            brand: sanitizeText(product.brand, 100),
            category_id: parseInt(product.category_id) || null,
            category_name: sanitizeText(product.category_name, 100),
            sku: sanitizeText(product.sku, 50),
            barcode: sanitizeText(product.barcode, 50),
            unit: sanitizeText(product.unit || 'pcs', 20),
            size: sanitizeText(product.size, 50),
            color: sanitizeText(product.color, 50),
            weight: Math.max(0, parseFloat(product.weight) || 0),

            // Multilingual support
            name_bn: sanitizeText(product.bn_name, 100),
            bn_name: sanitizeText(product.bn_name, 100),
            description_bn: sanitizeText(product.bn_description, 1000),
            bn_description: sanitizeText(product.bn_description, 1000),

            // Stock information
            current_stock: currentStock,
            total_stock: currentStock,
            min_stock_level: minStockLevel,
            max_stock_level: maxStockLevel,

            // Pricing
            selling_price: sellingPrice,
            price: sellingPrice,
            cost_price: costPrice,
            cost: costPrice,
            cost_cents: Math.round(costPrice * 100),
            price_cents: Math.round(sellingPrice * 100),

            // Other attributes
            tax_rate: Math.max(0, Math.min(100, parseFloat(product.tax_rate) || 0)),
            tax_exempt: Boolean(product.tax_rate === 0),
            images: imageUrls,
            image_urls: imageUrls,
            is_active: Boolean(product.is_active),
            is_trackable: Boolean(product.is_trackable),

            // Timestamps
            created_at: product.created_at,
            updated_at: product.updated_at,

            // Calculate stock status
            stock_status: currentStock === 0 ? 'out_of_stock' :
                         currentStock <= minStockLevel ? 'low_stock' : 'in_stock'
          };
        } catch (formatError) {
          return null;
        }
      })
      .filter(product => product !== null);

    return products;

  } catch (error) {
    // Production error handling - don't expose internal details
    throw new Error('Failed to retrieve products. Please try again.');
  }
}
