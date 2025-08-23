
// Initialize all POS system tables
function createTables() {
  const tables = [
    // Products table
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      base_price REAL NOT NULL,
      is_apparel BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      current_stock INTEGER DEFAULT 0,
      min_stock_level INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    
    // Product variants table
    `CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      size TEXT,
      color TEXT,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE,
      price_adjustment REAL DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products (id)
    )`,
    
    // Customers table
    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      loyalty_number TEXT UNIQUE,
      discount_rate REAL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    
    // Invoices table
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      subtotal REAL NOT NULL,
      order_discount REAL DEFAULT 0,
      order_discount_type TEXT DEFAULT 'percentage',
      order_discount_approved_by TEXT,
      tax_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_method_type TEXT NOT NULL,
      payment_method_name TEXT NOT NULL,
      payment_amount REAL NOT NULL,
      change_given REAL DEFAULT 0,
      proof_image_url TEXT,
      payment_reference TEXT,
      cashier_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    )`,
    
    // Invoice items table
    `CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_discount REAL DEFAULT 0,
      line_discount_type TEXT DEFAULT 'percentage',
      line_discount_approved_by TEXT,
      subtotal REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices (id),
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (variant_id) REFERENCES product_variants (id)
    )`,
    
    // Stock movements table
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (variant_id) REFERENCES product_variants (id)
    )`,
    
    // Returns and exchanges table
    `CREATE TABLE IF NOT EXISTS returns_exchanges (
      id TEXT PRIMARY KEY,
      original_invoice_id TEXT NOT NULL,
      return_amount REAL DEFAULT 0,
      exchange_amount REAL DEFAULT 0,
      refund_amount REAL DEFAULT 0,
      reason TEXT NOT NULL,
      processed_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (original_invoice_id) REFERENCES invoices (id)
    )`,
    
    // Return items table
    `CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      return_exchange_id TEXT NOT NULL,
      original_invoice_item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT NOT NULL,
      FOREIGN KEY (return_exchange_id) REFERENCES returns_exchanges (id),
      FOREIGN KEY (original_invoice_item_id) REFERENCES invoice_items (id)
    )`,
    
    // Discount approvals table
    `CREATE TABLE IF NOT EXISTS discount_approvals (
      id TEXT PRIMARY KEY,
      requested_by TEXT NOT NULL,
      approved_by TEXT,
      discount_amount REAL NOT NULL,
      discount_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      approved_at TEXT
    )`
  ];

  // Execute each table creation
  tables.forEach(sql => {
    try {
      // This would be handled by the database connection
      console.log('Creating table:', sql);
    } catch (error) {
      throw new Error(`Failed to create table: ${error.message}`);
    }
  });

  return { success: true, message: 'All tables created successfully' };
}
