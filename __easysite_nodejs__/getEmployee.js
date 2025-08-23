
function getEmployee(employeeId) {
  const Database = require('better-sqlite3');
  const db = new Database('pos_system.db');

  try {
    const employee = db.prepare(`
      SELECT * FROM employees WHERE id = ? OR employee_id = ?
    `).get(employeeId, employeeId);

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get photo IDs
    const photoIds = db.prepare(`
      SELECT * FROM employee_photo_ids 
      WHERE employee_id = ? 
      ORDER BY is_primary DESC, created_at DESC
    `).all(employee.id);

    // Get recent time tracking
    const recentTimeTracking = db.prepare(`
      SELECT * FROM time_tracking 
      WHERE employee_id = ? 
      ORDER BY clock_in_time DESC 
      LIMIT 10
    `).all(employee.id);

    return {
      ...employee,
      photo_ids: photoIds,
      recent_time_tracking: recentTimeTracking
    };
  } catch (error) {
    throw new Error(`Failed to get employee: ${error.message}`);
  } finally {
    db.close();
  }
}