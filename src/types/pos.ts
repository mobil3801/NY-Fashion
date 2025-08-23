
export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  isApparel: boolean;
  isActive: boolean;
  variants: ProductVariant[];
  currentStock: number;
  minStockLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  size?: string;
  color?: string;
  sku: string;
  barcode?: string;
  priceAdjustment: number;
  stockQuantity: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  loyaltyNumber?: string;
  discountRate?: number;
  createdAt: string;
}

export interface CartItem {
  id: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineDiscountType: 'percentage' | 'fixed';
  lineDiscountApprovedBy?: string;
  subtotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customer?: Customer;
  items: CartItem[];
  subtotal: number;
  orderDiscount: number;
  orderDiscountType: 'percentage' | 'fixed';
  orderDiscountApprovedBy?: string;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentDetails: PaymentDetails;
  cashierId: string;
  createdAt: string;
  status: 'completed' | 'refunded' | 'partially_refunded';
}

export interface PaymentMethod {
  type: 'cash' | 'external_device';
  name: string;
}

export interface PaymentDetails {
  amountPaid: number;
  changeGiven?: number;
  proofImageUrl?: string;
  referenceNumber?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  variantId?: string;
  movementType: 'sale' | 'return' | 'adjustment' | 'restock';
  quantity: number;
  referenceId?: string;
  referenceType?: 'invoice' | 'return' | 'adjustment';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface ReturnExchange {
  id: string;
  originalInvoiceId: string;
  returnItems: ReturnItem[];
  exchangeItems?: CartItem[];
  returnAmount: number;
  exchangeAmount: number;
  refundAmount: number;
  reason: string;
  processedBy: string;
  createdAt: string;
}

export interface ReturnItem {
  originalCartItemId: string;
  quantity: number;
  reason: string;
}

export interface DiscountApproval {
  id: string;
  requestedBy: string;
  approvedBy?: string;
  discountAmount: number;
  discountType: 'percentage' | 'fixed';
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  approvedAt?: string;
}

export interface POSState {
  cart: CartItem[];
  customer?: Customer;
  orderDiscount: number;
  orderDiscountType: 'percentage' | 'fixed';
  paymentMethod?: PaymentMethod;
  currentInvoice?: Invoice;
}

export interface TaxCalculation {
  subtotal: number;
  taxableAmount: number;
  taxAmount: number;
  taxRate: number;
  exemptAmount: number;
}