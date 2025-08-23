
function savePhotoId(photoIdData) {
  const Database = require('better-sqlite3');
  const db = new Database('pos_system.db');

  try {
    db.exec('BEGIN TRANSACTION');

    const {
      id,
      employee_id,
      id_type,
      id_number,
      front_image_url,
      back_image_url,
      issue_date,
      expiry_date,
      is_primary,
      notes
    } = photoIdData;

    // Mask the ID number (show only last 4 characters)
    const id_number_masked = id_number.length > 4 ?
    '*'.repeat(id_number.length - 4) + id_number.slice(-4) :
    '*'.repeat(id_number.length);

    // If setting as primary, remove primary flag from other IDs
    if (is_primary) {
      db.prepare(`
        UPDATE employee_photo_ids 
        SET is_primary = FALSE 
        WHERE employee_id = ?
      `).run(employee_id);
    }

    let result;

    if (id) {
      // Update existing photo ID
      const stmt = db.prepare(`
        UPDATE employee_photo_ids SET
          id_type = ?,
          id_number = ?,
          id_number_masked = ?,
          front_image_url = ?,
          back_image_url = ?,
          issue_date = ?,
          expiry_date = ?,
          is_primary = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        id_type, id_number, id_number_masked, front_image_url, back_image_url,
        issue_date, expiry_date, is_primary, notes, id
      );

      result = { id, message: "Photo ID updated successfully" };
    } else {
      // Create new photo ID
      const stmt = db.prepare(`
        INSERT INTO employee_photo_ids (
          employee_id, id_type, id_number, id_number_masked, front_image_url,
          back_image_url, issue_date, expiry_date, is_primary, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertResult = stmt.run(
        employee_id, id_type, id_number, id_number_masked, front_image_url,
        back_image_url, issue_date, expiry_date, is_primary, notes
      );

      result = { id: insertResult.lastInsertRowid, message: "Photo ID created successfully" };
    }

    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error(`Failed to save photo ID: ${error.message}`);
  } finally {
    db.close();
  }
}