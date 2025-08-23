
function seedInventoryData() {
  try {
    console.log('Starting inventory data seeding...');

    // First, seed categories if they don't exist
    const categories = [
      { name: 'Saree', slug: 'saree', bn_name: 'শাড়ি', tax_exempt: false },
      { name: 'Salwar Kameez', slug: 'salwar-kameez', bn_name: 'সালোয়ার কামিজ', tax_exempt: false },
      { name: 'Kurti', slug: 'kurti', bn_name: 'কুর্তি', tax_exempt: false },
      { name: 'Lehenga', slug: 'lehenga', bn_name: 'লেহেঙ্গা', tax_exempt: false },
      { name: 'Hijab', slug: 'hijab', bn_name: 'হিজাব', tax_exempt: false },
      { name: 'Palazzo', slug: 'palazzo', bn_name: 'প্যালাজো', tax_exempt: false }
    ];

    let categoryIds = {};
    
    // Insert categories
    for (const category of categories) {
      try {
        const existing = window.ezsite.db.query(
          'SELECT id FROM categories WHERE slug = $1',
          [category.slug]
        );

        if (existing && existing.length > 0) {
          categoryIds[category.slug] = existing[0].id;
          console.log(`Category ${category.name} already exists with ID: ${existing[0].id}`);
        } else {
          const result = window.ezsite.db.query(
            'INSERT INTO categories (name, slug, bn_name, tax_exempt) VALUES ($1, $2, $3, $4) RETURNING id',
            [category.name, category.slug, category.bn_name, category.tax_exempt]
          );
          if (result && result[0]) {
            categoryIds[category.slug] = result[0].id;
            console.log(`Created category ${category.name} with ID: ${result[0].id}`);
          }
        }
      } catch (catError) {
        console.error(`Error creating category ${category.name}:`, catError);
      }
    }

    // Sample products with realistic inventory data for women's fashion
    const products = [
      // Sarees
      {
        category_slug: 'saree',
        name: 'Traditional Silk Saree',
        bn_name: 'ঐতিহ্যবাহী সিল্ক শাড়ি',
        description: 'Beautiful hand-woven silk saree with intricate border design',
        bn_description: 'সুন্দর হাতে বোনা সিল্ক শাড়ি জটিল বর্ডার ডিজাইন সহ',
        brand: 'Katan Silk',
        sku: 'SAR-SLK-001',
        barcode: '1234567890001',
        cost_price: 2500,
        selling_price: 4000,
        current_stock: 2, // Low stock
        min_stock_level: 5,
        max_stock_level: 25,
        unit: 'pcs',
        size: 'Standard',
        color: 'Red',
        weight: 0.8
      },
      {
        category_slug: 'saree',
        name: 'Cotton Handloom Saree',
        bn_name: 'তুলা হ্যান্ডলুম শাড়ি',
        description: 'Comfortable cotton saree perfect for daily wear',
        bn_description: 'আরামদায়ক তুলার শাড়ি দৈনন্দিন পরিধানের জন্য উপযুক্ত',
        brand: 'Tangail',
        sku: 'SAR-COT-002',
        barcode: '1234567890002',
        cost_price: 800,
        selling_price: 1500,
        current_stock: 0, // Out of stock
        min_stock_level: 10,
        max_stock_level: 50,
        unit: 'pcs',
        size: 'Standard',
        color: 'Blue',
        weight: 0.6
      },
      
      // Salwar Kameez
      {
        category_slug: 'salwar-kameez',
        name: 'Embroidered Three Piece Set',
        bn_name: 'এমব্রয়ডার করা তিন পিস সেট',
        description: 'Elegant embroidered salwar kameez with dupatta',
        bn_description: 'দুপাট্টা সহ মার্জিত এমব্রয়ডার করা সালোয়ার কামিজ',
        brand: 'Rang Bangladesh',
        sku: 'SKZ-EMB-003',
        barcode: '1234567890003',
        cost_price: 1200,
        selling_price: 2200,
        current_stock: 4, // Low stock
        min_stock_level: 8,
        max_stock_level: 30,
        unit: 'sets',
        size: 'M',
        color: 'Green',
        weight: 0.7
      },
      {
        category_slug: 'salwar-kameez',
        name: 'Casual Cotton Salwar Suit',
        bn_name: 'ক্যাজুয়াল তুলা সালোয়ার স্যুট',
        description: 'Comfortable casual wear salwar suit',
        bn_description: 'আরামদায়ক ক্যাজুয়াল পরিধানের সালোয়ার স্যুট',
        brand: 'Aarong',
        sku: 'SKZ-CAS-004',
        barcode: '1234567890004',
        cost_price: 900,
        selling_price: 1700,
        current_stock: 12,
        min_stock_level: 6,
        max_stock_level: 25,
        unit: 'sets',
        size: 'L',
        color: 'Pink',
        weight: 0.5
      },
      
      // Kurtis
      {
        category_slug: 'kurti',
        name: 'Printed Long Kurti',
        bn_name: 'প্রিন্টেড লম্বা কুর্তি',
        description: 'Stylish printed kurti for modern women',
        bn_description: 'আধুনিক মহিলাদের জন্য স্টাইলিশ প্রিন্টেড কুর্তি',
        brand: 'Fabindia',
        sku: 'KRT-PRT-005',
        barcode: '1234567890005',
        cost_price: 600,
        selling_price: 1200,
        current_stock: 1, // Very low stock
        min_stock_level: 5,
        max_stock_level: 40,
        unit: 'pcs',
        size: 'S',
        color: 'Yellow',
        weight: 0.3
      },
      {
        category_slug: 'kurti',
        name: 'A-Line Cotton Kurti',
        bn_name: 'এ-লাইন তুলা কুর্তি',
        description: 'Comfortable A-line kurti in pure cotton',
        bn_description: 'খাঁটি তুলায় আরামদায়ক এ-লাইন কুর্তি',
        brand: 'W for Woman',
        sku: 'KRT-ALN-006',
        barcode: '1234567890006',
        cost_price: 450,
        selling_price: 900,
        current_stock: 18,
        min_stock_level: 8,
        max_stock_level: 35,
        unit: 'pcs',
        size: 'M',
        color: 'White',
        weight: 0.25
      },
      
      // Lehengas
      {
        category_slug: 'lehenga',
        name: 'Bridal Lehenga Set',
        bn_name: 'দুলহানের লেহেঙ্গা সেট',
        description: 'Luxurious bridal lehenga with heavy embroidery',
        bn_description: 'ভারী এমব্রয়ডারি সহ বিলাসবহুল দুলহানের লেহেঙ্গা',
        brand: 'Manish Malhotra',
        sku: 'LHG-BRD-007',
        barcode: '1234567890007',
        cost_price: 8000,
        selling_price: 15000,
        current_stock: 0, // Out of stock - expensive item
        min_stock_level: 2,
        max_stock_level: 8,
        unit: 'sets',
        size: 'Custom',
        color: 'Maroon',
        weight: 2.5
      },
      
      // Hijabs
      {
        category_slug: 'hijab',
        name: 'Chiffon Hijab',
        bn_name: 'শিফন হিজাব',
        description: 'Lightweight chiffon hijab in various colors',
        bn_description: 'বিভিন্ন রঙে হালকা শিফন হিজাব',
        brand: 'Modesty',
        sku: 'HJB-CHF-008',
        barcode: '1234567890008',
        cost_price: 200,
        selling_price: 450,
        current_stock: 3, // Low stock
        min_stock_level: 15,
        max_stock_level: 100,
        unit: 'pcs',
        size: 'Standard',
        color: 'Black',
        weight: 0.1
      },
      {
        category_slug: 'hijab',
        name: 'Cotton Jersey Hijab',
        bn_name: 'তুলা জার্সি হিজাব',
        description: 'Comfortable cotton jersey hijab for everyday wear',
        bn_description: 'প্রতিদিন পরিধানের জন্য আরামদায়ক তুলা জার্সি হিজাব',
        brand: 'Al-Hooda',
        sku: 'HJB-JER-009',
        barcode: '1234567890009',
        cost_price: 150,
        selling_price: 350,
        current_stock: 25,
        min_stock_level: 20,
        max_stock_level: 80,
        unit: 'pcs',
        size: 'Standard',
        color: 'Navy',
        weight: 0.12
      },
      
      // Palazzo
      {
        category_slug: 'palazzo',
        name: 'Flared Palazzo Pants',
        bn_name: 'ফ্লেয়ার্ড প্যালাজো প্যান্ট',
        description: 'Comfortable flared palazzo pants',
        bn_description: 'আরামদায়ক ফ্লেয়ার্ড প্যালাজো প্যান্ট',
        brand: 'Global Desi',
        sku: 'PLZ-FLR-010',
        barcode: '1234567890010',
        cost_price: 400,
        selling_price: 800,
        current_stock: 1, // Low stock
        min_stock_level: 6,
        max_stock_level: 30,
        unit: 'pcs',
        size: 'L',
        color: 'Beige',
        weight: 0.4
      }
    ];

    // Insert products
    let insertedProducts = 0;
    for (const product of products) {
      try {
        const categoryId = categoryIds[product.category_slug];
        if (!categoryId) {
          console.error(`Category not found for slug: ${product.category_slug}`);
          continue;
        }

        // Check if product already exists
        const existing = window.ezsite.db.query(
          'SELECT id FROM products WHERE sku = $1',
          [product.sku]
        );

        if (existing && existing.length > 0) {
          console.log(`Product ${product.name} already exists with SKU: ${product.sku}`);
          continue;
        }

        // Insert product
        const result = window.ezsite.db.query(`
          INSERT INTO products (
            category_id, name, bn_name, description, bn_description, brand, 
            sku, barcode, cost_price, selling_price, current_stock, 
            min_stock_level, max_stock_level, unit, size, color, weight,
            is_active, is_trackable, cost_cents, price_cents, tax_rate,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
            $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW()
          ) RETURNING id
        `, [
          categoryId,
          product.name,
          product.bn_name,
          product.description,
          product.bn_description,
          product.brand,
          product.sku,
          product.barcode,
          product.cost_price,
          product.selling_price,
          product.current_stock,
          product.min_stock_level,
          product.max_stock_level,
          product.unit,
          product.size,
          product.color,
          product.weight,
          true, // is_active
          true, // is_trackable
          Math.round(product.cost_price * 100), // cost_cents
          Math.round(product.selling_price * 100), // price_cents
          0 // tax_rate
        ]);

        if (result && result[0]) {
          insertedProducts++;
          console.log(`Created product: ${product.name} (ID: ${result[0].id})`);
        }

      } catch (productError) {
        console.error(`Error creating product ${product.name}:`, productError);
      }
    }

    const summary = {
      message: 'Inventory data seeding completed',
      categories_processed: Object.keys(categoryIds).length,
      products_inserted: insertedProducts,
      timestamp: new Date().toISOString()
    };

    console.log('Seeding summary:', summary);
    return summary;

  } catch (error) {
    console.error('Error in seedInventoryData:', error);
    throw new Error(`Failed to seed inventory data: ${error.message}`);
  }
}
