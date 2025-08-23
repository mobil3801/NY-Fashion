
export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  tax_id: string;
  payment_terms: string;
  credit_limit: number;
  currency: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_invoiced: number;
  unit_cost: number;
  total_cost: number;
  description?: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  status: 'draft' | 'sent' | 'received' | 'partial' | 'closed';
  order_date: string;
  expected_date?: string;
  received_date?: string;
  subtotal: number;
  freight_cost: number;
  duty_cost: number;
  other_costs: number;
  total_cost: number;
  currency: string;
  notes?: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  items: PurchaseOrderItem[];
}

export interface POReceipt {
  id: string;
  po_id: string;
  receipt_number: string;
  received_date: string;
  received_by: string;
  notes?: string;
  items: POReceiptItem[];
  created_at: string;
}

export interface POReceiptItem {
  id: string;
  receipt_id: string;
  po_item_id: string;
  product_id: string;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  condition: 'good' | 'damaged' | 'partial';
  notes?: string;
}

export interface POInvoice {
  id: string;
  po_id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  currency: string;
  file_url?: string;
  file_name?: string;
  status: 'pending' | 'approved' | 'paid';
  created_at: string;
  updated_at: string;
}

export interface LandedCost {
  freight: number;
  duty: number;
  insurance: number;
  handling: number;
  other: number;
}