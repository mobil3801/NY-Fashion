
async function batchFileUpload(files, uploadType, entityId, metadata = {}) {
  try {
    if (!files || !Array.isArray(files)) {
      throw new Error('Files array is required');
    }

    if (!uploadType) {
      throw new Error('Upload type is required');
    }

    const uploadResults = [];
    const errors = [];

    // Process files in batches to avoid overwhelming the storage system
    const batchSize = 3;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file, index) => {
        try {
          // Validate file
          const validation = await window.ezsite.apis.run({
            path: 'validateFileUpload',
            param: [file, uploadType]
          });

          if (validation.error) {
            throw new Error(validation.error);
          }

          // Generate unique filename
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileExtension = file.name.split('.').pop();
          const filename = `${uploadType}_${entityId}_${timestamp}_${randomSuffix}.${fileExtension}`;

          // Upload to storage
          const uploadResult = await window.ezsite.apis.upload({
            filename: filename,
            file: file
          });

          if (uploadResult.error) {
            throw new Error(`Upload failed: ${uploadResult.error}`);
          }

          // Get file URL
          const urlResult = await window.ezsite.apis.getUploadUrl(uploadResult.data);
          if (urlResult.error) {
            throw new Error(`Failed to get file URL: ${urlResult.error}`);
          }

          return {
            success: true,
            originalName: file.name,
            filename: filename,
            fileId: uploadResult.data,
            url: urlResult.data,
            size: file.size,
            type: file.type,
            index: i + index
          };

        } catch (error) {
          return {
            success: false,
            originalName: file.name,
            error: error.message,
            index: i + index
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          uploadResults.push(result);
        } else {
          errors.push(result);
        }
      });

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      message: `Batch upload completed. ${uploadResults.length} successful, ${errors.length} failed.`,
      successful: uploadResults,
      failed: errors,
      totalProcessed: files.length
    };

  } catch (error) {
    console.error('Batch file upload error:', error);
    throw new Error(`Failed to upload files: ${error.message}`);
  }
}
