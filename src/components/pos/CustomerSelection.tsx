
import React, { useState, useEffect } from 'react';
import { User, UserPlus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Customer } from '@/types/pos';
import { usePOS } from '@/contexts/POSContext';
import { useToast } from '@/hooks/use-toast';

const CustomerSelection: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    loyaltyNumber: ''
  });

  const { state, setCustomer } = usePOS();
  const { toast } = useToast();

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchCustomers();
    } else {
      setCustomers([]);
    }
  }, [searchQuery]);

  const searchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data } = await window.ezsite.apis.run({
        path: 'getCustomers',
        param: [searchQuery]
      });
      setCustomers(data || []);
    } catch (error) {
      toast({
        title: 'Search Error',
        description: 'Failed to search customers',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setCustomer(customer);
    setSearchQuery('');
    setCustomers([]);
    
    toast({
      title: 'Customer Selected',
      description: `${customer.name} selected`,
    });
  };

  const handleRemoveCustomer = () => {
    setCustomer(undefined);
    toast({
      title: 'Customer Removed',
      description: 'Transaction will be processed as walk-in',
    });
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name) {
      toast({
        title: 'Validation Error',
        description: 'Customer name is required',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Generate customer ID
      const customerId = `cust-${Date.now()}`;
      const customer: Customer = {
        id: customerId,
        name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone,
        loyaltyNumber: newCustomer.loyaltyNumber,
        discountRate: 0,
        createdAt: new Date().toISOString()
      };

      // In a real app, you would save to database here
      handleSelectCustomer(customer);
      setShowCustomerDialog(false);
      setNewCustomer({ name: '', email: '', phone: '', loyaltyNumber: '' });
      
      toast({
        title: 'Customer Created',
        description: `${customer.name} created and selected`,
      });
    } catch (error) {
      toast({
        title: 'Creation Error',
        description: 'Failed to create customer',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Customer
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {state.customer ? (
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div>
              <h4 className="font-medium">{state.customer.name}</h4>
              {state.customer.email && (
                <p className="text-sm text-gray-600">{state.customer.email}</p>
              )}
              {state.customer.phone && (
                <p className="text-sm text-gray-600">{state.customer.phone}</p>
              )}
              {state.customer.loyaltyNumber && (
                <Badge variant="secondary" className="mt-1">
                  {state.customer.loyaltyNumber}
                </Badge>
              )}
              {state.customer.discountRate && state.customer.discountRate > 0 && (
                <Badge variant="destructive" className="mt-1 ml-2">
                  {state.customer.discountRate}% Discount
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveCustomer}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Customer Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search customers by name, phone, or loyalty number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {isLoading && (
              <div className="text-center py-2 text-gray-500">Searching...</div>
            )}

            {customers.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{customer.name}</h4>
                        {customer.email && (
                          <p className="text-sm text-gray-600">{customer.email}</p>
                        )}
                        {customer.phone && (
                          <p className="text-sm text-gray-600">{customer.phone}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {customer.loyaltyNumber && (
                          <Badge variant="secondary">{customer.loyaltyNumber}</Badge>
                        )}
                        {customer.discountRate && customer.discountRate > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {customer.discountRate}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !isLoading && customers.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No customers found
              </div>
            )}

            {/* Add New Customer */}
            <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add New Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name *</label>
                    <Input
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Customer name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1-555-0123"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Loyalty Number</label>
                    <Input
                      value={newCustomer.loyaltyNumber}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, loyaltyNumber: e.target.value }))}
                      placeholder="LOYAL001"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCustomerDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateCustomer}>
                      Create Customer
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Skip Customer */}
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => {
                toast({
                  title: 'Walk-in Customer',
                  description: 'Processing as walk-in transaction',
                });
              }}
            >
              Continue as Walk-in Customer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerSelection;
