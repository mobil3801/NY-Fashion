
import React, { useState } from 'react';
import { Plus, Search, Filter, FileText, CheckCircle, Clock, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePurchaseOrder } from '@/contexts/PurchaseOrderContext';
import { PurchaseOrder } from '@/types/purchase';
import PurchaseOrderForm from './PurchaseOrderForm';
import POReceivingProcess from './POReceivingProcess';

const PurchaseOrderManagement = () => {
  const { purchaseOrders, loading, updatePOStatus } = usePurchaseOrder();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showReceiving, setShowReceiving] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'sent': return 'default';
      case 'partial': return 'outline';
      case 'received': return 'default';
      case 'closed': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <FileText className="h-4 w-4" />;
      case 'sent': return <Clock className="h-4 w-4" />;
      case 'partial': return <Truck className="h-4 w-4" />;
      case 'received': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <CheckCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreatePO = () => {
    setSelectedPO(null);
    setShowForm(true);
  };

  const handleEditPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowForm(true);
  };

  const handleReceiveItems = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowReceiving(true);
  };

  const handleApprovePO = async (poId: string) => {
    try {
      await updatePOStatus(poId, 'sent', { approve: true });
    } catch (error) {
      console.error('Error approving PO:', error);
    }
  };

  const handleClosePO = async (poId: string) => {
    try {
      await updatePOStatus(poId, 'closed');
    } catch (error) {
      console.error('Error closing PO:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Purchase Orders</h2>
        </div>
        <Button onClick={handleCreatePO}>
          <Plus className="h-4 w-4 mr-2" />
          Create PO
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Draft</p>
                <p className="text-2xl font-bold">
                  {purchaseOrders.filter(po => po.status === 'draft').length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sent</p>
                <p className="text-2xl font-bold">
                  {purchaseOrders.filter(po => po.status === 'sent').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Partial</p>
                <p className="text-2xl font-bold">
                  {purchaseOrders.filter(po => po.status === 'partial').length}
                </p>
              </div>
              <Truck className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Received</p>
                <p className="text-2xl font-bold">
                  {purchaseOrders.filter(po => po.status === 'received').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Purchase Orders ({filteredPOs.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search POs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Date</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading purchase orders...
                  </TableCell>
                </TableRow>
              ) : filteredPOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No purchase orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPOs.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.supplier_name}</TableCell>
                    <TableCell>{new Date(po.order_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      {po.currency} {po.total_cost.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(po.status)} className="flex items-center gap-1 w-fit">
                        {getStatusIcon(po.status)}
                        {po.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPO(po)}
                        >
                          Edit
                        </Button>
                        {po.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprovePO(po.id)}
                          >
                            Approve
                          </Button>
                        )}
                        {(po.status === 'sent' || po.status === 'partial') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReceiveItems(po)}
                          >
                            Receive
                          </Button>
                        )}
                        {po.status === 'received' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClosePO(po.id)}
                          >
                            Close
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPO ? 'Edit Purchase Order' : 'Create New Purchase Order'}
            </DialogTitle>
          </DialogHeader>
          <PurchaseOrderForm
            purchaseOrder={selectedPO}
            onClose={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiving} onOpenChange={setShowReceiving}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Items - {selectedPO?.po_number}</DialogTitle>
          </DialogHeader>
          <POReceivingProcess
            purchaseOrder={selectedPO}
            onClose={() => setShowReceiving(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrderManagement;
