
async function createUploadSession(totalFiles, uploadType, entityId) {
  try {
    if (!totalFiles || totalFiles <= 0) {
      throw new Error('Total files count is required');
    }

    if (!uploadType) {
      throw new Error('Upload type is required');
    }

    // Generate unique session ID
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create session record
    const insertQuery = `
      INSERT INTO upload_sessions (
        session_id, 
        upload_type, 
        entity_id, 
        total_files, 
        completed_files, 
        failed_files, 
        status, 
        created_at
      ) VALUES ($1, $2, $3, $4, 0, 0, 'in_progress', NOW())
      RETURNING session_id, status, created_at
    `;

    const result = await window.ezsite.db.query(insertQuery, [
    sessionId,
    uploadType,
    entityId ? parseInt(entityId) : null,
    parseInt(totalFiles)]
    );

    if (!result || result.length === 0) {
      throw new Error('Failed to create upload session');
    }

    return {
      sessionId: sessionId,
      status: 'created',
      totalFiles: totalFiles,
      message: 'Upload session created successfully'
    };

  } catch (error) {
    console.error('Create upload session error:', error);
    throw new Error(`Failed to create upload session: ${error.message}`);
  }
}