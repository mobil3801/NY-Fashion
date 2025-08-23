
function createEmployeeTables() {
  const Database = require('better-sqlite3');
  const db = new Database('pos_system.db');
  
  try {
    // Employee profiles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        employee_id TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        address TEXT,
        date_of_birth DATE,
        hire_date DATE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('Employee', 'Manager', 'Admin')),
        status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Terminated')),
        department TEXT,
        position TEXT,
        salary DECIMAL(10,2),
        profile_picture_url TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Photo IDs table for storing multiple ID documents
    db.exec(`
      CREATE TABLE IF NOT EXISTS employee_photo_ids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        id_type TEXT NOT NULL CHECK (id_type IN ('Drivers License', 'Passport', 'National ID', 'Work Permit', 'Other')),
        id_number TEXT NOT NULL,
        id_number_masked TEXT NOT NULL,
        front_image_url TEXT NOT NULL,
        back_image_url TEXT,
        issue_date DATE,
        expiry_date DATE,
        is_primary BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        verified_by INTEGER,
        verified_at DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
        FOREIGN KEY (verified_by) REFERENCES employees (id)
      )
    `);

    // Time tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS time_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        clock_in_time DATETIME NOT NULL,
        clock_out_time DATETIME,
        break_start_time DATETIME,
        break_end_time DATETIME,
        total_hours DECIMAL(5,2),
        break_hours DECIMAL(5,2) DEFAULT 0,
        notes TEXT,
        location TEXT,
        adjusted_by INTEGER,
        adjustment_reason TEXT,
        adjustment_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
        FOREIGN KEY (adjusted_by) REFERENCES employees (id)
      )
    `);

    // Employee access permissions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS employee_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        permission_type TEXT NOT NULL,
        resource_id TEXT,
        granted_by INTEGER NOT NULL,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES employees (id)
      )
    `);

    return { message: "Employee tables created successfully" };
  } catch (error) {
    throw new Error(`Failed to create employee tables: ${error.message}`);
  } finally {
    db.close();
  }
}
