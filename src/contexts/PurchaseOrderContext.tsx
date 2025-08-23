
import React, { createContext, useContext, useState, useEffect } from 'react';
import { PurchaseOrder, Supplier, POReceipt, POInvoice } from '@/types/purchase';
import { toast } from '@/hooks/use-toast';

interface PurchaseOrderContextType {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  receipts: POReceipt[];
  invoices: POInvoice[];
  loading: boolean;
  refreshSuppliers: () => Promise<void>;
  refreshPurchaseOrders: () => Promise<void>;
  saveSupplier: (supplier: Partial<Supplier>) => Promise<string>;
  savePurchaseOrder: (po: Partial<PurchaseOrder>) => Promise<string>;
  updatePOStatus: (poId: string, status: string, options?: any) => Promise<void>;
  receivePOItems: (receiptData: any) => Promise<any>;
  uploadInvoice: (file: File, poId: string, invoiceData: any) => Promise<void>;
}

const PurchaseOrderContext = createContext<PurchaseOrderContextType | undefined>(undefined);

export const PurchaseOrderProvider: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<POReceipt[]>([]);
  const [invoices, setInvoices] = useState<POInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize tables
  useEffect(() => {
    const initTables = async () => {
      try {
        await window.ezsite.apis.run({ path: 'createPurchaseTables.js', param: [] });
        await refreshSuppliers();
        await refreshPurchaseOrders();
      } catch (error) {
        console.error('Error initializing purchase tables:', error);
        toast({
          title: "Initialization Error",
          description: "Failed to initialize purchase order system",
          variant: "destructive"
        });
      }
    };

    initTables();
  }, []);

  const refreshSuppliers = async () => {
    try {
      setLoading(true);
      const { data } = await window.ezsite.apis.run({
        path: 'getSuppliers.js',
        param: []
      });
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast({
        title: "Error",
        description: "Failed to load suppliers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshPurchaseOrders = async () => {
    try {
      setLoading(true);
      const { data } = await window.ezsite.apis.run({
        path: 'getPurchaseOrders.js',
        param: []
      });
      setPurchaseOrders(data || []);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      toast({
        title: "Error",
        description: "Failed to load purchase orders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSupplier = async (supplier: Partial<Supplier>): Promise<string> => {
    try {
      const { data } = await window.ezsite.apis.run({
        path: 'saveSupplier.js',
        param: [supplier]
      });

      await refreshSuppliers();
      toast({
        title: "Success",
        description: supplier.id ? "Supplier updated successfully" : "Supplier created successfully"
      });

      return data.id;
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({
        title: "Error",
        description: "Failed to save supplier",
        variant: "destructive"
      });
      throw error;
    }
  };

  const savePurchaseOrder = async (po: Partial<PurchaseOrder>): Promise<string> => {
    try {
      const { data } = await window.ezsite.apis.run({
        path: 'savePurchaseOrder.js',
        param: [po]
      });

      await refreshPurchaseOrders();
      toast({
        title: "Success",
        description: po.id ? "Purchase order updated successfully" : "Purchase order created successfully"
      });

      return data.id;
    } catch (error) {
      console.error('Error saving purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to save purchase order",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updatePOStatus = async (poId: string, status: string, options?: any) => {
    try {
      await window.ezsite.apis.run({
        path: 'updatePOStatus.js',
        param: [poId, status, 'current-user', options]
      });

      await refreshPurchaseOrders();
      toast({
        title: "Success",
        description: `Purchase order status updated to ${status}`
      });
    } catch (error) {
      console.error('Error updating PO status:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase order status",
        variant: "destructive"
      });
      throw error;
    }
  };

  const receivePOItems = async (receiptData: any) => {
    try {
      const { data } = await window.ezsite.apis.run({
        path: 'receivePOItems.js',
        param: [receiptData]
      });

      await refreshPurchaseOrders();
      toast({
        title: "Success",
        description: "Items received successfully"
      });

      return data;
    } catch (error) {
      console.error('Error receiving PO items:', error);
      toast({
        title: "Error",
        description: "Failed to receive items",
        variant: "destructive"
      });
      throw error;
    }
  };

  const uploadInvoice = async (file: File, poId: string, invoiceData: any) => {
    try {
      // Here we would implement file upload to EasySite storage
      // For now, we'll simulate it
      const fileUrl = `invoices/${Date.now()}-${file.name}`;

      // Save invoice data with file reference
      const invoiceWithFile = {
        ...invoiceData,
        po_id: poId,
        file_url: fileUrl,
        file_name: file.name
      };

      // In a real implementation, you would upload to EasySite storage here
      // await window.ezsite.storage.upload(file, fileUrl);

      toast({
        title: "Success",
        description: "Invoice uploaded successfully"
      });

    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast({
        title: "Error",
        description: "Failed to upload invoice",
        variant: "destructive"
      });
      throw error;
    }
  };

  return (
    <PurchaseOrderContext.Provider
      value={{
        suppliers,
        purchaseOrders,
        receipts,
        invoices,
        loading,
        refreshSuppliers,
        refreshPurchaseOrders,
        saveSupplier,
        savePurchaseOrder,
        updatePOStatus,
        receivePOItems,
        uploadInvoice
      }}>

      {children}
    </PurchaseOrderContext.Provider>);

};

export const usePurchaseOrder = () => {
  const context = useContext(PurchaseOrderContext);
  if (context === undefined) {
    throw new Error('usePurchaseOrder must be used within a PurchaseOrderProvider');
  }
  return context;
};