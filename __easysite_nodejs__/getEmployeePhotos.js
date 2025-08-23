
async function getEmployeePhotos(employeeId) {
  try {
    if (!employeeId) {
      throw new Error('Employee ID is required');
    }

    const query = `
      SELECT 
        id,
        employee_id,
        id_type,
        id_number_masked,
        front_image_url,
        back_image_url,
        front_file_id,
        back_file_id,
        issue_date,
        expiry_date,
        is_primary,
        is_verified,
        notes,
        created_at,
        updated_at
      FROM employee_photos 
      WHERE employee_id = $1 
      ORDER BY is_primary DESC, created_at DESC
    `;

    const result = await window.ezsite.db.query(query, [parseInt(employeeId)]);

    return {
      photos: result || [],
      count: result?.length || 0,
      primaryPhoto: result?.find((p) => p.is_primary) || null
    };

  } catch (error) {
    console.error('Get employee photos error:', error);
    throw new Error(`Failed to get employee photos: ${error.message}`);
  }
}