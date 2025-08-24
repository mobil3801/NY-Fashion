
function uploadProductImages(productId, files) {
  try {
    // Input validation
    if (!productId || isNaN(parseInt(productId))) {
      throw new Error('Valid product ID is required');
    }

    if (!files) {
      throw new Error('No files provided');
    }

    const pId = parseInt(productId);
    
    // Normalize files input to array
    const filesToProcess = Array.isArray(files) ? files : [files];

    if (filesToProcess.length === 0) {
      throw new Error('No valid files provided');
    }

    // Validate file constraints
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB per file
    const maxFiles = 10; // Maximum files per product

    if (filesToProcess.length > maxFiles) {
      throw new Error(`Maximum ${maxFiles} images allowed per upload`);
    }

    // Check if product exists
    const productCheckQuery = `
      SELECT id, name, is_active 
      FROM products 
      WHERE id = $1
    `;

    let productResult;
    try {
      productResult = window.ezsite.db.query(productCheckQuery, [pId]);
    } catch (dbError) {
      throw new Error('Database query failed');
    }

    if (!productResult || productResult.length === 0) {
      throw new Error('Product not found');
    }

    const product = productResult[0];

    // Check current image count
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM product_images 
      WHERE product_id = $1
    `;

    const countResult = window.ezsite.db.query(countQuery, [pId]);
    const currentCount = parseInt(countResult[0]?.count || 0);

    if (currentCount + filesToProcess.length > maxFiles) {
      throw new Error(`Cannot upload ${filesToProcess.length} images. Maximum ${maxFiles} images per product. Current count: ${currentCount}`);
    }

    const uploadedImages = [];
    const errors = [];

    // Process each file
    for (let i = 0; i < filesToProcess.length; i++) {
      try {
        const fileData = filesToProcess[i];
        const file = fileData.file || fileData;

        // Validate individual file
        if (!file || typeof file !== 'object') {
          errors.push(`File ${i + 1}: Invalid file object`);
          continue;
        }

        if (!file.name || typeof file.name !== 'string') {
          errors.push(`File ${i + 1}: Missing filename`);
          continue;
        }

        if (!file.type || !allowedTypes.includes(file.type.toLowerCase())) {
          errors.push(`File ${file.name}: Invalid type. Allowed: JPG, PNG, WebP`);
          continue;
        }

        if (!file.size || file.size > maxFileSize) {
          errors.push(`File ${file.name}: Too large. Maximum size: 10MB`);
          continue;
        }

        if (file.size < 100) {
          errors.push(`File ${file.name}: File too small`);
          continue;
        }

        // Sanitize filename
        const sanitizedFilename = file.name.toString().trim().slice(0, 100);
        
        // Upload file to storage
        const uploadResult = window.ezsite.apis.upload({
          filename: sanitizedFilename,
          file: file
        });

        if (uploadResult.error) {
          errors.push(`File ${sanitizedFilename}: Upload failed - ${uploadResult.error}`);
          continue;
        }

        // Get the uploaded file URL
        const urlResult = window.ezsite.apis.getUploadUrl(uploadResult.data);
        if (urlResult.error) {
          errors.push(`File ${sanitizedFilename}: URL generation failed - ${urlResult.error}`);
          continue;
        }

        // Calculate sort order
        const sortOrder = currentCount + uploadedImages.length;

        // Prepare alt text
        const altText = (fileData.altText || fileData.alt_text || `${product.name} - Image ${sortOrder + 1}`)
          .toString().trim().slice(0, 200);

        // Save image record to database
        const insertQuery = `
          INSERT INTO product_images (
            product_id, image_url, alt_text, sort_order, file_size, mime_type, uploaded_at
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, image_url, alt_text, sort_order, file_size, mime_type, uploaded_at
        `;

        const insertResult = window.ezsite.db.query(insertQuery, [
          pId,
          urlResult.data,
          altText,
          sortOrder,
          parseInt(file.size),
          file.type,
          new Date().toISOString()
        ]);

        if (!insertResult || insertResult.length === 0) {
          errors.push(`File ${sanitizedFilename}: Database save failed`);
          continue;
        }

        uploadedImages.push({
          ...insertResult[0],
          original_filename: sanitizedFilename
        });

      } catch (fileError) {
        errors.push(`File ${i + 1}: ${fileError.message || 'Processing failed'}`);
      }
    }

    // Prepare response
    const response = {
      success: uploadedImages.length > 0,
      uploaded_count: uploadedImages.length,
      total_files: filesToProcess.length,
      images: uploadedImages
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.error_count = errors.length;
    }

    if (uploadedImages.length === 0) {
      throw new Error(`No images were uploaded successfully. Errors: ${errors.join('; ')}`);
    }

    if (uploadedImages.length < filesToProcess.length) {
      response.message = `Partially successful: ${uploadedImages.length} of ${filesToProcess.length} images uploaded`;
    } else {
      response.message = `Successfully uploaded ${uploadedImages.length} image(s)`;
    }

    return response;

  } catch (error) {
    // Production error handling
    if (error.message.includes('required') || 
        error.message.includes('not found') ||
        error.message.includes('Maximum') ||
        error.message.includes('Invalid') ||
        error.message.includes('No images were uploaded')) {
      throw new Error(error.message);
    }
    
    throw new Error('Failed to upload images. Please try again.');
  }
}
