
async function deleteEmployeePhoto(photoId) {
  try {
    if (!photoId) {
      throw new Error('Photo ID is required');
    }

    // Get photo record first
    const selectQuery = `
      SELECT id, employee_id, front_file_id, back_file_id, is_primary
      FROM employee_photos 
      WHERE id = $1
    `;
    const photoResult = await window.ezsite.db.query(selectQuery, [parseInt(photoId)]);
    
    if (!photoResult || photoResult.length === 0) {
      throw new Error('Photo ID not found');
    }

    const photo = photoResult[0];

    // Delete files from storage if file IDs exist
    if (photo.front_file_id) {
      try {
        // Note: EasySite storage delete API not available yet
        // await window.ezsite.apis.deleteFile(photo.front_file_id);
      } catch (error) {
        console.warn('Could not delete front image from storage:', error.message);
      }
    }

    if (photo.back_file_id) {
      try {
        // Note: EasySite storage delete API not available yet
        // await window.ezsite.apis.deleteFile(photo.back_file_id);
      } catch (error) {
        console.warn('Could not delete back image from storage:', error.message);
      }
    }

    // Delete from database
    const deleteQuery = `DELETE FROM employee_photos WHERE id = $1`;
    await window.ezsite.db.query(deleteQuery, [parseInt(photoId)]);

    // If this was a primary photo, set another as primary if available
    if (photo.is_primary) {
      const setPrimaryQuery = `
        UPDATE employee_photos 
        SET is_primary = TRUE 
        WHERE employee_id = $1 AND id != $2
        ORDER BY created_at ASC 
        LIMIT 1
      `;
      await window.ezsite.db.query(setPrimaryQuery, [photo.employee_id, parseInt(photoId)]);
    }

    return {
      message: 'Photo ID deleted successfully',
      deletedPhotoId: photoId
    };

  } catch (error) {
    console.error('Delete employee photo error:', error);
    throw new Error(`Failed to delete photo ID: ${error.message}`);
  }
}
