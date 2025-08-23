
function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  // Get current timestamp for uniqueness
  const timestamp = now.getTime().toString().slice(-6);

  // Format: YY-MM-DD-XXXXXX (e.g., 24-12-15-123456)
  const invoiceNumber = `${year}${month}${day}-${timestamp}`;

  return invoiceNumber;
}