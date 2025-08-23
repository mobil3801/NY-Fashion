
function saveEmployee(employeeData) {
  const Database = require('better-sqlite3');
  const db = new Database('pos_system.db');

  try {
    db.exec('BEGIN TRANSACTION');

    const {
      id,
      user_id,
      employee_id,
      first_name,
      last_name,
      email,
      phone,
      address,
      date_of_birth,
      hire_date,
      role,
      status,
      department,
      position,
      salary,
      profile_picture_url,
      emergency_contact_name,
      emergency_contact_phone,
      notes
    } = employeeData;

    let result;

    if (id) {
      // Update existing employee
      const stmt = db.prepare(`
        UPDATE employees SET
          employee_id = ?,
          first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          address = ?,
          date_of_birth = ?,
          hire_date = ?,
          role = ?,
          status = ?,
          department = ?,
          position = ?,
          salary = ?,
          profile_picture_url = ?,
          emergency_contact_name = ?,
          emergency_contact_phone = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        employee_id, first_name, last_name, email, phone, address, date_of_birth,
        hire_date, role, status, department, position, salary, profile_picture_url,
        emergency_contact_name, emergency_contact_phone, notes, id
      );

      result = { id, message: "Employee updated successfully" };
    } else {
      // Generate employee ID if not provided
      const empId = employee_id || `EMP${Date.now()}`;

      // Create new employee
      const stmt = db.prepare(`
        INSERT INTO employees (
          user_id, employee_id, first_name, last_name, email, phone, address,
          date_of_birth, hire_date, role, status, department, position, salary,
          profile_picture_url, emergency_contact_name, emergency_contact_phone, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertResult = stmt.run(
        user_id, empId, first_name, last_name, email, phone, address, date_of_birth,
        hire_date, role, status, department, position, salary, profile_picture_url,
        emergency_contact_name, emergency_contact_phone, notes
      );

      result = { id: insertResult.lastInsertRowid, employee_id: empId, message: "Employee created successfully" };
    }

    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error(`Failed to save employee: ${error.message}`);
  } finally {
    db.close();
  }
}