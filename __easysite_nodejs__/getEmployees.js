
function getEmployees(searchTerm = '', role = '', status = '', department = '', page = 1, limit = 50) {
  const Database = require('better-sqlite3');
  const db = new Database('pos_system.db');
  
  try {
    let query = `
      SELECT 
        e.*,
        COUNT(pt.id) as total_photo_ids,
        COUNT(CASE WHEN pt.is_verified = 1 THEN 1 END) as verified_photo_ids,
        (
          SELECT COUNT(*) 
          FROM time_tracking tt 
          WHERE tt.employee_id = e.id 
          AND DATE(tt.clock_in_time) = DATE('now')
          AND tt.clock_out_time IS NULL
        ) as is_clocked_in
      FROM employees e
      LEFT JOIN employee_photo_ids pt ON e.id = pt.employee_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (searchTerm) {
      query += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_id LIKE ?)`;
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (role) {
      query += ` AND e.role = ?`;
      params.push(role);
    }
    
    if (status) {
      query += ` AND e.status = ?`;
      params.push(status);
    }
    
    if (department) {
      query += ` AND e.department LIKE ?`;
      params.push(`%${department}%`);
    }
    
    query += ` GROUP BY e.id ORDER BY e.last_name, e.first_name`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    
    const employees = db.prepare(query).all(...params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM employees e
      WHERE 1=1
    `;
    
    const countParams = [];
    if (searchTerm) {
      countQuery += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_id LIKE ?)`;
      const searchPattern = `%${searchTerm}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    if (role) {
      countQuery += ` AND e.role = ?`;
      countParams.push(role);
    }
    
    if (status) {
      countQuery += ` AND e.status = ?`;
      countParams.push(status);
    }
    
    if (department) {
      countQuery += ` AND e.department LIKE ?`;
      countParams.push(`%${department}%`);
    }
    
    const { total } = db.prepare(countQuery).get(...countParams);
    
    return {
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw new Error(`Failed to get employees: ${error.message}`);
  } finally {
    db.close();
  }
}
