
function saveProduct(productData) {
  try {
    // Input validation
    if (!productData || typeof productData !== 'object') {
      throw new Error('Invalid product data provided');
    }

    const {
      id,
      name,
      description,
      brand,
      category_id,
      cost_price,
      selling_price,
      cost_cents,
      price_cents,
      tax_rate,
      tax_exempt,
      barcode,
      sku,
      unit,
      size,
      color,
      weight,
      current_stock,
      min_stock_level,
      max_stock_level,
      is_active,
      is_trackable,
      bn_name,
      bn_description,
      images,
      image_urls
    } = productData;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Product name is required');
    }

    if (!category_id || isNaN(parseInt(category_id))) {
      throw new Error('Valid category ID is required');
    }

    // Sanitize and validate input data
    const sanitizedName = name.toString().trim().slice(0, 100);
    const sanitizedDescription = (description || '').toString().trim().slice(0, 1000);
    const sanitizedBrand = (brand || '').toString().trim().slice(0, 100);
    const categoryId = parseInt(category_id);
    
    // Handle pricing with validation
    let finalCostPrice = Math.max(0, parseFloat(cost_price) || 0);
    let finalSellingPrice = Math.max(0, parseFloat(selling_price) || 0);
    
    // Fallback to cents if primary price fields are not provided
    if (finalCostPrice === 0 && cost_cents) {
      finalCostPrice = Math.max(0, parseInt(cost_cents) / 100);
    }
    if (finalSellingPrice === 0 && price_cents) {
      finalSellingPrice = Math.max(0, parseInt(price_cents) / 100);
    }

    // Calculate cents from price fields
    const finalCostCents = Math.round(finalCostPrice * 100);
    const finalPriceCents = Math.round(finalSellingPrice * 100);

    // Validate other numeric fields
    const finalTaxRate = Math.max(0, Math.min(100, parseFloat(tax_rate) || 0));
    const finalCurrentStock = Math.max(0, parseInt(current_stock) || 0);
    const finalMinStock = Math.max(0, parseInt(min_stock_level) || 5);
    const finalMaxStock = Math.max(finalMinStock, parseInt(max_stock_level) || 20);
    const finalWeight = Math.max(0, parseFloat(weight) || 0);

    // Sanitize optional text fields
    const sanitizedBarcode = (barcode || '').toString().trim().slice(0, 50);
    const sanitizedSku = (sku || '').toString().trim().slice(0, 50);
    const sanitizedUnit = (unit || 'pcs').toString().trim().slice(0, 20);
    const sanitizedSize = (size || '').toString().trim().slice(0, 50);
    const sanitizedColor = (color || '').toString().trim().slice(0, 50);
    const sanitizedBnName = (bn_name || '').toString().trim().slice(0, 100);
    const sanitizedBnDescription = (bn_description || '').toString().trim().slice(0, 1000);

    // Handle boolean fields
    const isActive = is_active !== false; // Default to true
    const isTrackable = Boolean(is_trackable);
    const taxExempt = Boolean(tax_exempt) || finalTaxRate === 0;

    // Handle image URLs
    let imageUrls = [];
    const imageData = images || image_urls;
    if (imageData) {
      try {
        if (Array.isArray(imageData)) {
          imageUrls = imageData.filter(url => typeof url === 'string' && url.trim());
        } else if (typeof imageData === 'string') {
          const parsed = JSON.parse(imageData);
          imageUrls = Array.isArray(parsed) ? parsed.filter(url => typeof url === 'string' && url.trim()) : [];
        }
      } catch (parseError) {
        imageUrls = [];
      }
    }
    const imagesJson = JSON.stringify(imageUrls);

    // Generate current timestamp
    const now = new Date().toISOString();

    if (id && parseInt(id)) {
      // Update existing product
      const updateQuery = `
        UPDATE products 
        SET 
          name = $1,
          description = $2,
          brand = $3,
          category_id = $4,
          cost_price = $5,
          selling_price = $6,
          cost_cents = $7,
          price_cents = $8,
          tax_rate = $9,
          barcode = $10,
          sku = $11,
          unit = $12,
          size = $13,
          color = $14,
          weight = $15,
          current_stock = $16,
          min_stock_level = $17,
          max_stock_level = $18,
          is_active = $19,
          is_trackable = $20,
          bn_name = $21,
          bn_description = $22,
          image_urls = $23,
          updated_at = $24
        WHERE id = $25
        RETURNING id
      `;

      const result = window.ezsite.db.query(updateQuery, [
        sanitizedName,
        sanitizedDescription,
        sanitizedBrand,
        categoryId,
        finalCostPrice,
        finalSellingPrice,
        finalCostCents,
        finalPriceCents,
        finalTaxRate,
        sanitizedBarcode,
        sanitizedSku,
        sanitizedUnit,
        sanitizedSize,
        sanitizedColor,
        finalWeight,
        finalCurrentStock,
        finalMinStock,
        finalMaxStock,
        isActive,
        isTrackable,
        sanitizedBnName,
        sanitizedBnDescription,
        imagesJson,
        now,
        parseInt(id)
      ]);

      if (!result || result.length === 0) {
        throw new Error('Product not found or could not be updated');
      }

      return { 
        id: parseInt(id), 
        message: 'Product updated successfully',
        success: true
      };

    } else {
      // Create new product
      const insertQuery = `
        INSERT INTO products (
          name, description, brand, category_id, cost_price, 
          selling_price, cost_cents, price_cents, tax_rate, barcode, 
          sku, unit, size, color, weight, current_stock, 
          min_stock_level, max_stock_level, is_active, is_trackable,
          bn_name, bn_description, image_urls, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        RETURNING id
      `;

      const result = window.ezsite.db.query(insertQuery, [
        sanitizedName,
        sanitizedDescription,
        sanitizedBrand,
        categoryId,
        finalCostPrice,
        finalSellingPrice,
        finalCostCents,
        finalPriceCents,
        finalTaxRate,
        sanitizedBarcode,
        sanitizedSku,
        sanitizedUnit,
        sanitizedSize,
        sanitizedColor,
        finalWeight,
        finalCurrentStock,
        finalMinStock,
        finalMaxStock,
        isActive,
        isTrackable,
        sanitizedBnName,
        sanitizedBnDescription,
        imagesJson,
        now,
        now
      ]);

      if (!result || result.length === 0) {
        throw new Error('Failed to create product');
      }

      return { 
        id: result[0].id, 
        message: 'Product created successfully',
        success: true
      };
    }

  } catch (error) {
    // Production error handling - provide user-friendly messages
    if (error.message.includes('unique constraint') || error.message.includes('duplicate')) {
      throw new Error('Product with this SKU or barcode already exists');
    }
    if (error.message.includes('foreign key') || error.message.includes('category')) {
      throw new Error('Invalid category selected');
    }
    if (error.message.includes('required')) {
      throw new Error(error.message);
    }
    
    throw new Error('Failed to save product. Please check your input and try again.');
  }
}
