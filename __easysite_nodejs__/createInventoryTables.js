
function createInventoryTables() {
  const tables = [
  // Categories table for women's wear categories
  `CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            name_bn TEXT,
            description TEXT,
            parent_id INTEGER,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES categories(id)
        )`,

  // Products table
  `CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_bn TEXT,
            description TEXT,
            category_id INTEGER NOT NULL,
            brand TEXT,
            sku TEXT UNIQUE NOT NULL,
            barcode TEXT UNIQUE,
            cost_price DECIMAL(10,2) DEFAULT 0,
            selling_price DECIMAL(10,2) DEFAULT 0,
            msrp DECIMAL(10,2) DEFAULT 0,
            min_stock_level INTEGER DEFAULT 0,
            max_stock_level INTEGER DEFAULT 100,
            unit TEXT DEFAULT 'pcs',
            weight DECIMAL(8,2),
            dimensions TEXT,
            is_active BOOLEAN DEFAULT 1,
            has_variants BOOLEAN DEFAULT 0,
            tags TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`,

  // Product variants table
  `CREATE TABLE IF NOT EXISTS product_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            variant_name TEXT NOT NULL,
            sku TEXT UNIQUE NOT NULL,
            barcode TEXT UNIQUE,
            size TEXT,
            color TEXT,
            material TEXT,
            cost_price DECIMAL(10,2) DEFAULT 0,
            selling_price DECIMAL(10,2) DEFAULT 0,
            msrp DECIMAL(10,2) DEFAULT 0,
            current_stock INTEGER DEFAULT 0,
            reserved_stock INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )`,

  // Product images table
  `CREATE TABLE IF NOT EXISTS product_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            variant_id INTEGER,
            image_url TEXT NOT NULL,
            image_alt TEXT,
            is_primary BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
        )`,

  // Stock movements table for tracking all stock changes
  `CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            variant_id INTEGER,
            movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt', 'sale', 'adjustment', 'return', 'transfer')),
            reference_type TEXT, -- 'invoice', 'adjustment', 'transfer', etc.
            reference_id INTEGER,
            quantity INTEGER NOT NULL,
            unit_cost DECIMAL(10,2),
            total_cost DECIMAL(10,2),
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (variant_id) REFERENCES product_variants(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`,

  // Inventory adjustments table
  `CREATE TABLE IF NOT EXISTS inventory_adjustments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            adjustment_number TEXT UNIQUE NOT NULL,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
            total_items INTEGER DEFAULT 0,
            total_value DECIMAL(10,2) DEFAULT 0,
            notes TEXT,
            created_by INTEGER,
            approved_by INTEGER,
            approved_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (approved_by) REFERENCES users(id)
        )`,

  // Inventory adjustment items
  `CREATE TABLE IF NOT EXISTS inventory_adjustment_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            adjustment_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            variant_id INTEGER,
            current_stock INTEGER NOT NULL,
            adjusted_stock INTEGER NOT NULL,
            difference INTEGER NOT NULL,
            unit_cost DECIMAL(10,2),
            total_cost DECIMAL(10,2),
            reason TEXT,
            FOREIGN KEY (adjustment_id) REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (variant_id) REFERENCES product_variants(id)
        )`,

  // Audit log for tracking changes
  `CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            record_id INTEGER NOT NULL,
            action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
            old_values TEXT, -- JSON
            new_values TEXT, -- JSON
            user_id INTEGER,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`];


  // Execute table creation
  tables.forEach((sql) => {
    window.ezsite.db.exec(sql);
  });

  // Insert default categories for Bangladeshi women's wear
  const categories = [
  { name: 'Saree', name_bn: 'শাড়ি', description: 'Traditional Bengali sarees' },
  { name: 'Salwar Kameez', name_bn: 'সালোয়ার কামিজ', description: 'Three-piece outfit with dupatta' },
  { name: 'Kurti', name_bn: 'কুর্তি', description: 'Long tunic tops' },
  { name: 'Lehenga', name_bn: 'লেহেঙ্গা', description: 'Flared skirt with choli and dupatta' },
  { name: 'Churidar', name_bn: 'চুড়িদার', description: 'Fitted trouser with kurta' },
  { name: 'Palazzo Set', name_bn: 'প্যালাজো সেট', description: 'Wide-leg pants with kurta' },
  { name: 'Anarkali', name_bn: 'আনারকলি', description: 'Flared kurta dress' },
  { name: 'Sharara', name_bn: 'শরারা', description: 'Flared pants with kurta' },
  { name: 'Abaya', name_bn: 'আবায়া', description: 'Long flowing gown' },
  { name: 'Hijab & Accessories', name_bn: 'হিজাব ও আনুষাঙ্গিক', description: 'Head covering and accessories' }];


  categories.forEach((category) => {
    try {
      window.ezsite.db.exec(
        `INSERT OR IGNORE INTO categories (name, name_bn, description) VALUES (?, ?, ?)`,
        [category.name, category.name_bn, category.description]
      );
    } catch (error) {
      console.log(`Category ${category.name} already exists`);
    }
  });

  return { success: true, message: 'Inventory tables created successfully' };
}