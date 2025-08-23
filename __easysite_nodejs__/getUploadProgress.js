
async function getUploadProgress(uploadSessionId) {
  try {
    if (!uploadSessionId) {
      throw new Error('Upload session ID is required');
    }

    // Check upload session status from database
    const query = `
      SELECT 
        id,
        session_id,
        total_files,
        completed_files,
        failed_files,
        status,
        created_at,
        updated_at
      FROM upload_sessions 
      WHERE session_id = $1
    `;

    const result = await window.ezsite.db.query(query, [uploadSessionId]);

    if (!result || result.length === 0) {
      return {
        sessionId: uploadSessionId,
        status: 'not_found',
        progress: 0,
        totalFiles: 0,
        completedFiles: 0,
        failedFiles: 0
      };
    }

    const session = result[0];
    const progress = session.total_files > 0 ?
    Math.round(session.completed_files / session.total_files * 100) : 0;

    return {
      sessionId: uploadSessionId,
      status: session.status,
      progress: progress,
      totalFiles: session.total_files,
      completedFiles: session.completed_files,
      failedFiles: session.failed_files,
      createdAt: session.created_at,
      updatedAt: session.updated_at
    };

  } catch (error) {
    console.error('Get upload progress error:', error);
    throw new Error(`Failed to get upload progress: ${error.message}`);
  }
}