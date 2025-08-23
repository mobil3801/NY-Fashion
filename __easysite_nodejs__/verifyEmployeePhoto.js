
async function verifyEmployeePhoto(photoId, verified, verifiedBy) {
  try {
    if (!photoId) {
      throw new Error('Photo ID is required');
    }

    if (typeof verified !== 'boolean') {
      throw new Error('Verified status must be boolean');
    }

    // Update verification status
    const updateQuery = `
      UPDATE employee_photos 
      SET 
        is_verified = $1,
        verified_by = $2,
        verified_at = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING id, is_verified, verified_at
    `;

    const result = await window.ezsite.db.query(updateQuery, [
      verified,
      verifiedBy || null,
      verified ? new Date().toISOString() : null,
      parseInt(photoId)
    ]);

    if (!result || result.length === 0) {
      throw new Error('Photo ID not found');
    }

    return {
      id: photoId,
      verified: verified,
      message: `Photo ID ${verified ? 'verified' : 'unverified'} successfully`
    };

  } catch (error) {
    console.error('Verify employee photo error:', error);
    throw new Error(`Failed to verify photo ID: ${error.message}`);
  }
}
