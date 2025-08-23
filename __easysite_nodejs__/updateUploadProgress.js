
async function updateUploadProgress(sessionId, completedFiles, failedFiles, status = null) {
  try {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    // Get current session
    const currentQuery = `
      SELECT total_files, completed_files, failed_files 
      FROM upload_sessions 
      WHERE session_id = $1
    `;
    const currentResult = await window.ezsite.db.query(currentQuery, [sessionId]);

    if (!currentResult || currentResult.length === 0) {
      throw new Error('Upload session not found');
    }

    const current = currentResult[0];
    const newCompleted = completedFiles !== undefined ? completedFiles : current.completed_files;
    const newFailed = failedFiles !== undefined ? failedFiles : current.failed_files;

    // Determine status if not provided
    let newStatus = status;
    if (!newStatus) {
      const totalProcessed = newCompleted + newFailed;
      if (totalProcessed >= current.total_files) {
        newStatus = newFailed > 0 ? 'completed_with_errors' : 'completed';
      } else {
        newStatus = 'in_progress';
      }
    }

    // Update session
    const updateQuery = `
      UPDATE upload_sessions 
      SET 
        completed_files = $1,
        failed_files = $2,
        status = $3,
        updated_at = NOW()
      WHERE session_id = $4
      RETURNING session_id, status, completed_files, failed_files, total_files
    `;

    const result = await window.ezsite.db.query(updateQuery, [
    newCompleted,
    newFailed,
    newStatus,
    sessionId]
    );

    if (!result || result.length === 0) {
      throw new Error('Failed to update upload progress');
    }

    const updated = result[0];
    const progress = updated.total_files > 0 ?
    Math.round(updated.completed_files / updated.total_files * 100) : 0;

    return {
      sessionId: sessionId,
      status: updated.status,
      progress: progress,
      completedFiles: updated.completed_files,
      failedFiles: updated.failed_files,
      totalFiles: updated.total_files
    };

  } catch (error) {
    console.error('Update upload progress error:', error);
    throw new Error(`Failed to update upload progress: ${error.message}`);
  }
}