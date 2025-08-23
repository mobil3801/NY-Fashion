
async function uploadEmployeePhoto(employeeId, photoData, files) {
  try {
    if (!employeeId) {
      throw new Error('Employee ID is required');
    }

    if (!photoData) {
      throw new Error('Photo ID data is required');
    }

    const { frontImageFile, backImageFile } = files || {};
    
    if (!frontImageFile) {
      throw new Error('Front image is required');
    }

    // Validate file types and sizes
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    // Validate front image
    if (!allowedTypes.includes(frontImageFile.type)) {
      throw new Error('Front image has invalid type. Only JPG, PNG, and WebP are allowed.');
    }

    if (frontImageFile.size > maxFileSize) {
      throw new Error('Front image is too large. Maximum size is 10MB.');
    }

    // Validate back image if provided
    if (backImageFile) {
      if (!allowedTypes.includes(backImageFile.type)) {
        throw new Error('Back image has invalid type. Only JPG, PNG, and WebP are allowed.');
      }

      if (backImageFile.size > maxFileSize) {
        throw new Error('Back image is too large. Maximum size is 10MB.');
      }
    }

    // Upload front image
    const frontUploadResult = await window.ezsite.apis.upload({
      filename: `employee_${employeeId}_id_front_${Date.now()}.${frontImageFile.name.split('.').pop()}`,
      file: frontImageFile
    });

    if (frontUploadResult.error) {
      throw new Error(`Failed to upload front image: ${frontUploadResult.error}`);
    }

    const frontUrlResult = await window.ezsite.apis.getUploadUrl(frontUploadResult.data);
    if (frontUrlResult.error) {
      throw new Error(`Failed to get front image URL: ${frontUrlResult.error}`);
    }

    let backImageUrl = null;
    let backFileId = null;

    // Upload back image if provided
    if (backImageFile) {
      const backUploadResult = await window.ezsite.apis.upload({
        filename: `employee_${employeeId}_id_back_${Date.now()}.${backImageFile.name.split('.').pop()}`,
        file: backImageFile
      });

      if (backUploadResult.error) {
        throw new Error(`Failed to upload back image: ${backUploadResult.error}`);
      }

      const backUrlResult = await window.ezsite.apis.getUploadUrl(backUploadResult.data);
      if (backUrlResult.error) {
        throw new Error(`Failed to get back image URL: ${backUrlResult.error}`);
      }

      backImageUrl = backUrlResult.data;
      backFileId = backUploadResult.data;
    }

    // Mask the ID number (show only last 4 characters)
    const id_number_masked = photoData.id_number.length > 4 ?
      '*'.repeat(photoData.id_number.length - 4) + photoData.id_number.slice(-4) :
      '*'.repeat(photoData.id_number.length);

    // Begin database transaction
    await window.ezsite.db.query('BEGIN');

    try {
      // If setting as primary, remove primary flag from other IDs
      if (photoData.is_primary) {
        await window.ezsite.db.query(`
          UPDATE employee_photos 
          SET is_primary = FALSE 
          WHERE employee_id = $1
        `, [parseInt(employeeId)]);
      }

      let result;

      if (photoData.id) {
        // Update existing photo ID
        const updateQuery = `
          UPDATE employee_photos SET
            id_type = $1,
            id_number = $2,
            id_number_masked = $3,
            front_image_url = $4,
            back_image_url = $5,
            front_file_id = $6,
            back_file_id = $7,
            issue_date = $8,
            expiry_date = $9,
            is_primary = $10,
            notes = $11,
            updated_at = NOW()
          WHERE id = $12
          RETURNING id, id_type, id_number_masked, front_image_url, back_image_url, is_primary, is_verified
        `;

        const updateResult = await window.ezsite.db.query(updateQuery, [
          photoData.id_type,
          photoData.id_number,
          id_number_masked,
          frontUrlResult.data,
          backImageUrl,
          frontUploadResult.data,
          backFileId,
          photoData.issue_date,
          photoData.expiry_date,
          photoData.is_primary,
          photoData.notes,
          photoData.id
        ]);

        result = updateResult[0];
        result.message = 'Photo ID updated successfully';

      } else {
        // Create new photo ID
        const insertQuery = `
          INSERT INTO employee_photos (
            employee_id, id_type, id_number, id_number_masked, front_image_url,
            back_image_url, front_file_id, back_file_id, issue_date, expiry_date, 
            is_primary, notes, is_verified, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, NOW())
          RETURNING id, id_type, id_number_masked, front_image_url, back_image_url, is_primary, is_verified
        `;

        const insertResult = await window.ezsite.db.query(insertQuery, [
          parseInt(employeeId),
          photoData.id_type,
          photoData.id_number,
          id_number_masked,
          frontUrlResult.data,
          backImageUrl,
          frontUploadResult.data,
          backFileId,
          photoData.issue_date,
          photoData.expiry_date,
          photoData.is_primary,
          photoData.notes
        ]);

        result = insertResult[0];
        result.message = 'Photo ID created successfully';
      }

      await window.ezsite.db.query('COMMIT');
      return result;

    } catch (error) {
      await window.ezsite.db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Upload employee photo error:', error);
    throw new Error(`Failed to upload employee photo: ${error.message}`);
  }
}
