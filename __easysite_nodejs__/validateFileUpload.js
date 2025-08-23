
function validateFileUpload(file, type = 'general') {
  if (!file) {
    throw new Error('No file provided');
  }

  const validationRules = {
    image: {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxSize: 5 * 1024 * 1024, // 5MB
      extensions: ['.jpg', '.jpeg', '.png', '.webp']
    },
    employee_photo: {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxSize: 10 * 1024 * 1024, // 10MB
      extensions: ['.jpg', '.jpeg', '.png', '.webp']
    },
    invoice: {
      allowedTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      maxSize: 10 * 1024 * 1024, // 10MB
      extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx']
    },
    general: {
      allowedTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/json'
      ],
      maxSize: 5 * 1024 * 1024, // 5MB
      extensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.json']
    }
  };

  const rules = validationRules[type] || validationRules.general;

  // Check file type
  if (!rules.allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed types: ${rules.extensions.join(', ')}`);
  }

  // Check file size
  if (file.size > rules.maxSize) {
    const maxSizeMB = (rules.maxSize / (1024 * 1024)).toFixed(1);
    throw new Error(`File is too large. Maximum size is ${maxSizeMB}MB.`);
  }

  // Check file extension
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  if (!rules.extensions.includes(fileExtension)) {
    throw new Error(`Invalid file extension. Allowed extensions: ${rules.extensions.join(', ')}`);
  }

  // Additional security checks
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    throw new Error('Invalid file name. File name contains illegal characters.');
  }

  if (file.size === 0) {
    throw new Error('File is empty');
  }

  return {
    isValid: true,
    fileType: type,
    sanitizedName: file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  };
}
