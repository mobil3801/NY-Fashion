
function createPurchaseTables() {
  const { Database } = require('sqlite3');
  const path = require('path');
  
  return new Promise((resolve, reject) => {
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    const db = new Database(dbPath);
    
    db.serialize(() => {
      // Suppliers table
      db.run(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contact_person TEXT,
          email TEXT,
          phone TEXT,
          address TEXT,
          city TEXT,
          country TEXT,
          tax_id TEXT,
          payment_terms TEXT DEFAULT '30 days',
          credit_limit REAL DEFAULT 0,
          currency TEXT DEFAULT 'USD',
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Purchase orders table
      db.run(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id TEXT PRIMARY KEY,
          po_number TEXT UNIQUE NOT NULL,
          supplier_id TEXT NOT NULL,
          supplier_name TEXT NOT NULL,
          status TEXT DEFAULT 'draft',
          order_date DATE NOT NULL,
          expected_date DATE,
          received_date DATE,
          subtotal REAL DEFAULT 0,
          freight_cost REAL DEFAULT 0,
          duty_cost REAL DEFAULT 0,
          other_costs REAL DEFAULT 0,
          total_cost REAL DEFAULT 0,
          currency TEXT DEFAULT 'USD',
          notes TEXT,
          created_by TEXT NOT NULL,
          approved_by TEXT,
          approved_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
      `);

      // Purchase order items table
      db.run(`
        CREATE TABLE IF NOT EXISTS po_items (
          id TEXT PRIMARY KEY,
          po_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          sku TEXT NOT NULL,
          quantity_ordered INTEGER NOT NULL,
          quantity_received INTEGER DEFAULT 0,
          quantity_invoiced INTEGER DEFAULT 0,
          unit_cost REAL NOT NULL,
          total_cost REAL NOT NULL,
          description TEXT,
          FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);

      // PO receipts table
      db.run(`
        CREATE TABLE IF NOT EXISTS po_receipts (
          id TEXT PRIMARY KEY,
          po_id TEXT NOT NULL,
          receipt_number TEXT NOT NULL,
          received_date DATE NOT NULL,
          received_by TEXT NOT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
        )
      `);

      // PO receipt items table
      db.run(`
        CREATE TABLE IF NOT EXISTS po_receipt_items (
          id TEXT PRIMARY KEY,
          receipt_id TEXT NOT NULL,
          po_item_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          quantity_received INTEGER NOT NULL,
          unit_cost REAL NOT NULL,
          total_cost REAL NOT NULL,
          condition TEXT DEFAULT 'good',
          notes TEXT,
          FOREIGN KEY (receipt_id) REFERENCES po_receipts(id),
          FOREIGN KEY (po_item_id) REFERENCES po_items(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);

      // PO invoices table
      db.run(`
        CREATE TABLE IF NOT EXISTS po_invoices (
          id TEXT PRIMARY KEY,
          po_id TEXT NOT NULL,
          supplier_id TEXT NOT NULL,
          invoice_number TEXT NOT NULL,
          invoice_date DATE NOT NULL,
          due_date DATE NOT NULL,
          amount REAL NOT NULL,
          currency TEXT DEFAULT 'USD',
          file_url TEXT,
          file_name TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
      `);
    });

    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve({ success: true });
      }
    });
  });
}

module.exports = createPurchaseTables;
