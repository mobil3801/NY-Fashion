
function getTimeTracking(employeeId, startDate = '', endDate = '', page = 1, limit = 50) {
  const Database = require('better-sqlite3');
  const db = new Database('pos_system.db');
  
  try {
    let query = `
      SELECT 
        tt.*,
        e.first_name,
        e.last_name,
        e.employee_id,
        adj.first_name as adjusted_by_name,
        adj.last_name as adjusted_by_lastname
      FROM time_tracking tt
      JOIN employees e ON tt.employee_id = e.id
      LEFT JOIN employees adj ON tt.adjusted_by = adj.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (employeeId) {
      query += ` AND tt.employee_id = ?`;
      params.push(employeeId);
    }
    
    if (startDate) {
      query += ` AND DATE(tt.clock_in_time) >= ?`;
      params.push(startDate);
    }
    
    if (endDate) {
      query += ` AND DATE(tt.clock_in_time) <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY tt.clock_in_time DESC`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    
    const timeEntries = db.prepare(query).all(...params);
    
    // Get current status for employee
    let currentStatus = null;
    if (employeeId) {
      currentStatus = db.prepare(`
        SELECT 
          tt.*,
          CASE 
            WHEN tt.clock_out_time IS NULL AND tt.break_start_time IS NOT NULL AND tt.break_end_time IS NULL THEN 'on_break'
            WHEN tt.clock_out_time IS NULL THEN 'clocked_in'
            ELSE 'clocked_out'
          END as status
        FROM time_tracking tt
        WHERE tt.employee_id = ?
        AND DATE(tt.clock_in_time) = DATE('now')
        ORDER BY tt.clock_in_time DESC
        LIMIT 1
      `).get(employeeId);
    }
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM time_tracking tt
      WHERE 1=1
    `;
    
    const countParams = [];
    if (employeeId) {
      countQuery += ` AND tt.employee_id = ?`;
      countParams.push(employeeId);
    }
    
    if (startDate) {
      countQuery += ` AND DATE(tt.clock_in_time) >= ?`;
      countParams.push(startDate);
    }
    
    if (endDate) {
      countQuery += ` AND DATE(tt.clock_in_time) <= ?`;
      countParams.push(endDate);
    }
    
    const { total } = db.prepare(countQuery).get(...countParams);
    
    return {
      timeEntries,
      currentStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw new Error(`Failed to get time tracking data: ${error.message}`);
  } finally {
    db.close();
  }
}
