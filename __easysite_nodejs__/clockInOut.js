
function clockInOut(employeeId, action, location = '', notes = '') {
  const Database = require('better-sqlite3');
  const db = new Database('pos_system.db');
  
  try {
    const currentTime = new Date().toISOString();
    
    if (action === 'clock_in') {
      // Check if already clocked in today
      const existingEntry = db.prepare(`
        SELECT * FROM time_tracking 
        WHERE employee_id = ? 
        AND DATE(clock_in_time) = DATE('now')
        AND clock_out_time IS NULL
      `).get(employeeId);
      
      if (existingEntry) {
        throw new Error('Already clocked in today');
      }
      
      // Create new time tracking entry
      const stmt = db.prepare(`
        INSERT INTO time_tracking (employee_id, clock_in_time, location, notes)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(employeeId, currentTime, location, notes);
      
      return { 
        id: result.lastInsertRowid,
        action: 'clocked_in',
        time: currentTime,
        message: "Clocked in successfully"
      };
      
    } else if (action === 'clock_out') {
      // Find today's open time tracking entry
      const openEntry = db.prepare(`
        SELECT * FROM time_tracking 
        WHERE employee_id = ? 
        AND DATE(clock_in_time) = DATE('now')
        AND clock_out_time IS NULL
        ORDER BY clock_in_time DESC
        LIMIT 1
      `).get(employeeId);
      
      if (!openEntry) {
        throw new Error('No clock-in entry found for today');
      }
      
      // Calculate total hours
      const clockInTime = new Date(openEntry.clock_in_time);
      const clockOutTime = new Date(currentTime);
      const totalHours = ((clockOutTime - clockInTime) / (1000 * 60 * 60)) - (openEntry.break_hours || 0);
      
      // Update the entry with clock out time
      const stmt = db.prepare(`
        UPDATE time_tracking SET
          clock_out_time = ?,
          total_hours = ?,
          notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || '; ' || ? END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(currentTime, totalHours.toFixed(2), notes, notes, openEntry.id);
      
      return { 
        id: openEntry.id,
        action: 'clocked_out',
        time: currentTime,
        total_hours: totalHours.toFixed(2),
        message: "Clocked out successfully"
      };
      
    } else if (action === 'break_start') {
      // Update current entry with break start time
      const openEntry = db.prepare(`
        SELECT * FROM time_tracking 
        WHERE employee_id = ? 
        AND DATE(clock_in_time) = DATE('now')
        AND clock_out_time IS NULL
        ORDER BY clock_in_time DESC
        LIMIT 1
      `).get(employeeId);
      
      if (!openEntry) {
        throw new Error('No active clock-in entry found');
      }
      
      if (openEntry.break_start_time && !openEntry.break_end_time) {
        throw new Error('Break already started');
      }
      
      const stmt = db.prepare(`
        UPDATE time_tracking SET
          break_start_time = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(currentTime, openEntry.id);
      
      return { 
        id: openEntry.id,
        action: 'break_started',
        time: currentTime,
        message: "Break started"
      };
      
    } else if (action === 'break_end') {
      // Update current entry with break end time and calculate break duration
      const openEntry = db.prepare(`
        SELECT * FROM time_tracking 
        WHERE employee_id = ? 
        AND DATE(clock_in_time) = DATE('now')
        AND clock_out_time IS NULL
        AND break_start_time IS NOT NULL
        AND break_end_time IS NULL
        ORDER BY clock_in_time DESC
        LIMIT 1
      `).get(employeeId);
      
      if (!openEntry) {
        throw new Error('No active break found');
      }
      
      // Calculate break duration
      const breakStart = new Date(openEntry.break_start_time);
      const breakEnd = new Date(currentTime);
      const breakHours = (breakEnd - breakStart) / (1000 * 60 * 60);
      const totalBreakHours = (openEntry.break_hours || 0) + breakHours;
      
      const stmt = db.prepare(`
        UPDATE time_tracking SET
          break_end_time = ?,
          break_hours = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(currentTime, totalBreakHours.toFixed(2), openEntry.id);
      
      return { 
        id: openEntry.id,
        action: 'break_ended',
        time: currentTime,
        break_duration: breakHours.toFixed(2),
        total_break_hours: totalBreakHours.toFixed(2),
        message: "Break ended"
      };
    }
    
    throw new Error('Invalid action');
    
  } catch (error) {
    throw new Error(`Failed to ${action}: ${error.message}`);
  } finally {
    db.close();
  }
}
