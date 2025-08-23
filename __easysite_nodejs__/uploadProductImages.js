
async function uploadProductImages(productId, files) {
  try {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    if (!files || !Array.isArray(files) && !files.file) {
      throw new Error('No files provided');
    }

    const filesToProcess = Array.isArray(files) ? files : [files];
    const uploadedImages = [];

    // Validate file types and sizes
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    for (const fileData of filesToProcess) {
      const file = fileData.file || fileData;

      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File ${file.name} has invalid type. Only JPG, PNG, and WebP are allowed.`);
      }

      if (file.size > maxFileSize) {
        throw new Error(`File ${file.name} is too large. Maximum size is 5MB.`);
      }
    }

    // Check current image count for product
    const existingImagesQuery = `
      SELECT COUNT(*) as count FROM product_images WHERE product_id = $1
    `;
    const existingResult = window.ezsite.db.query(existingImagesQuery, [parseInt(productId)]);
    const currentCount = existingResult[0]?.count || 0;

    if (currentCount + filesToProcess.length > 10) {
      throw new Error(`Cannot upload ${filesToProcess.length} images. Maximum 10 images per product allowed.`);
    }

    // Upload files and save to database
    for (let i = 0; i < filesToProcess.length; i++) {
      const fileData = filesToProcess[i];
      const file = fileData.file || fileData;

      // Upload file to storage
      const uploadResult = window.ezsite.apis.upload({
        filename: file.name,
        file: file
      });

      if (uploadResult.error) {
        throw new Error(`Failed to upload ${file.name}: ${uploadResult.error}`);
      }

      // Get the uploaded file URL
      const urlResult = window.ezsite.apis.getUploadUrl(uploadResult.data);
      if (urlResult.error) {
        throw new Error(`Failed to get URL for ${file.name}: ${urlResult.error}`);
      }

      // Calculate sort order (existing count + current index)
      const sortOrder = currentCount + i;

      // Save image record to database
      const insertQuery = `
        INSERT INTO product_images (
          product_id, image_url, alt_text, sort_order, file_size, mime_type, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, image_url, alt_text, sort_order, file_size, mime_type, uploaded_at
      `;

      const insertResult = window.ezsite.db.query(insertQuery, [
      parseInt(productId),
      urlResult.data,
      fileData.altText || `Product image ${sortOrder + 1}`,
      sortOrder,
      file.size,
      file.type]
      );

      if (!insertResult || insertResult.length === 0) {
        throw new Error(`Failed to save image record for ${file.name}`);
      }

      uploadedImages.push(insertResult[0]);
    }

    return {
      message: `Successfully uploaded ${uploadedImages.length} image(s)`,
      images: uploadedImages
    };

  } catch (error) {
    console.error('Upload product images error:', error);
    throw new Error(`Failed to upload images: ${error.message}`);
  }
}