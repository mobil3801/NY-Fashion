
function seedInventoryData(options = {}) {
  try {
    const {
      includeCategories = true,
      includeProducts = true,
      productCount = 50,
      includeStockMovements = true,
      clearExisting = false
    } = options;

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      operations: [],
      summary: {
        categories_created: 0,
        products_created: 0,
        movements_created: 0,
        errors: []
      }
    };

    // Helper function to add operation result
    const addOperation = (name, status, message, data = null) => {
      results.operations.push({
        name,
        status,
        message,
        data,
        timestamp: new Date().toISOString()
      });
    };

    // 1. Clear existing data if requested
    if (clearExisting) {
      try {
        // Clear in order of dependencies
        window.ezsite.db.query('DELETE FROM stock_movements');
        window.ezsite.db.query('DELETE FROM product_images');
        window.ezsite.db.query('DELETE FROM products');
        window.ezsite.db.query('DELETE FROM categories WHERE id > 1000'); // Keep system categories
        addOperation('Clear Existing Data', 'success', 'Existing test data cleared');
      } catch (clearError) {
        addOperation('Clear Existing Data', 'error', 'Failed to clear existing data');
        results.summary.errors.push('Data clearing failed');
      }
    }

    // 2. Create sample categories
    if (includeCategories) {
      const categories = [
        { name: 'Electronics', description: 'Electronic devices and accessories' },
        { name: 'Clothing', description: 'Apparel and fashion items' },
        { name: 'Books', description: 'Books and educational materials' },
        { name: 'Home & Garden', description: 'Home improvement and gardening supplies' },
        { name: 'Sports & Outdoors', description: 'Sports equipment and outdoor gear' },
        { name: 'Toys & Games', description: 'Toys, games, and entertainment' },
        { name: 'Health & Beauty', description: 'Health and beauty products' },
        { name: 'Automotive', description: 'Car parts and accessories' }
      ];

      for (const category of categories) {
        try {
          const insertCategoryQuery = `
            INSERT INTO categories (name, description, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (name) DO NOTHING
            RETURNING id
          `;

          const result = window.ezsite.db.query(insertCategoryQuery, [
            category.name,
            category.description,
            true,
            new Date().toISOString(),
            new Date().toISOString()
          ]);

          if (result && result.length > 0) {
            results.summary.categories_created++;
          }
        } catch (categoryError) {
          results.summary.errors.push(`Failed to create category: ${category.name}`);
        }
      }

      addOperation('Create Categories', 'success', `Created ${results.summary.categories_created} categories`);
    }

    // 3. Get available categories for product creation
    let availableCategories = [];
    try {
      const categoriesQuery = 'SELECT id, name FROM categories WHERE is_active = true LIMIT 10';
      availableCategories = window.ezsite.db.query(categoriesQuery) || [];
    } catch (categoriesError) {
      addOperation('Get Categories', 'error', 'Failed to retrieve categories');
      results.summary.errors.push('Could not retrieve categories for product creation');
    }

    // 4. Create sample products
    if (includeProducts && availableCategories.length > 0) {
      const productTemplates = [
        { name: 'Smartphone X1', brand: 'TechBrand', unit: 'piece', price: 699.99, cost: 450.00 },
        { name: 'Wireless Headphones', brand: 'AudioPro', unit: 'piece', price: 199.99, cost: 120.00 },
        { name: 'Laptop Bag', brand: 'CarryAll', unit: 'piece', price: 49.99, cost: 25.00 },
        { name: 'USB Cable', brand: 'ConnectCorp', unit: 'piece', price: 15.99, cost: 8.00 },
        { name: 'Blue Jeans', brand: 'DenimPlus', unit: 'piece', price: 89.99, cost: 35.00 },
        { name: 'Cotton T-Shirt', brand: 'ComfortWear', unit: 'piece', price: 24.99, cost: 12.00 },
        { name: 'Running Shoes', brand: 'FastFeet', unit: 'pair', price: 129.99, cost: 65.00 },
        { name: 'Coffee Mug', brand: 'BrewMaster', unit: 'piece', price: 12.99, cost: 5.00 },
        { name: 'Notebook Set', brand: 'WritePro', unit: 'set', price: 19.99, cost: 10.00 },
        { name: 'Garden Shovel', brand: 'GrowTools', unit: 'piece', price: 34.99, cost: 18.00 }
      ];

      const maxProducts = Math.min(productCount, 100); // Limit to reasonable number

      for (let i = 0; i < maxProducts; i++) {
        try {
          const template = productTemplates[i % productTemplates.length];
          const category = availableCategories[i % availableCategories.length];
          
          // Generate unique product data
          const productName = `${template.name} ${i + 1}`;
          const sku = `SKU-${Date.now()}-${i}`;
          const barcode = `${Math.random().toString().substring(2, 15)}`;
          const currentStock = Math.floor(Math.random() * 100) + 1;
          const minStock = Math.floor(Math.random() * 10) + 5;
          
          const insertProductQuery = `
            INSERT INTO products (
              name, description, brand, category_id, sku, barcode, unit,
              cost_price, selling_price, cost_cents, price_cents,
              current_stock, min_stock_level, max_stock_level,
              is_active, is_trackable, tax_rate,
              created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING id
          `;

          const result = window.ezsite.db.query(insertProductQuery, [
            productName,
            `High-quality ${template.name.toLowerCase()} from ${template.brand}`,
            template.brand,
            category.id,
            sku,
            barcode,
            template.unit,
            template.cost,
            template.price,
            Math.round(template.cost * 100),
            Math.round(template.price * 100),
            currentStock,
            minStock,
            Math.max(minStock + 10, 50),
            true,
            true,
            10.0, // 10% tax rate
            new Date().toISOString(),
            new Date().toISOString()
          ]);

          if (result && result.length > 0) {
            results.summary.products_created++;

            // Create stock movements for this product if requested
            if (includeStockMovements) {
              try {
                const movementQuery = `
                  INSERT INTO stock_movements (
                    product_id, variant_id, delta, type, reason, created_at, created_by
                  )
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                `;

                // Initial stock receipt
                window.ezsite.db.query(movementQuery, [
                  result[0].id,
                  null,
                  currentStock,
                  'receipt',
                  'Initial inventory setup',
                  new Date().toISOString(),
                  null
                ]);

                results.summary.movements_created++;
              } catch (movementError) {
                results.summary.errors.push(`Failed to create movement for product: ${productName}`);
              }
            }
          }
        } catch (productError) {
          results.summary.errors.push(`Failed to create product ${i + 1}`);
        }
      }

      addOperation('Create Products', 'success', `Created ${results.summary.products_created} products`);
      
      if (includeStockMovements) {
        addOperation('Create Stock Movements', 'success', `Created ${results.summary.movements_created} stock movements`);
      }
    }

    // 5. Final validation
    try {
      const validationQuery = `
        SELECT 
          (SELECT COUNT(*) FROM categories WHERE is_active = true) as categories,
          (SELECT COUNT(*) FROM products WHERE is_active = true) as products,
          (SELECT COUNT(*) FROM stock_movements) as movements
      `;
      
      const validation = window.ezsite.db.query(validationQuery);
      const counts = validation[0] || {};
      
      addOperation('Final Validation', 'success', 
        `Database now contains: ${counts.categories || 0} categories, ${counts.products || 0} products, ${counts.movements || 0} movements`
      );
      
      results.final_counts = {
        categories: parseInt(counts.categories) || 0,
        products: parseInt(counts.products) || 0,
        movements: parseInt(counts.movements) || 0
      };
      
    } catch (validationError) {
      addOperation('Final Validation', 'warning', 'Could not perform final validation');
    }

    // Set overall success status
    if (results.summary.errors.length > 0) {
      results.success = false;
      addOperation('Seed Operation', 'partial', `Completed with ${results.summary.errors.length} errors`);
    } else {
      addOperation('Seed Operation', 'success', 'All operations completed successfully');
    }

    return results;

  } catch (error) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      operations: [{
        name: 'Seed Operation',
        status: 'error',
        message: 'Seed operation failed completely',
        timestamp: new Date().toISOString()
      }],
      summary: {
        categories_created: 0,
        products_created: 0,
        movements_created: 0,
        errors: ['System error during seeding operation']
      },
      error: 'Seed operation encountered a system error'
    };
  }
}
