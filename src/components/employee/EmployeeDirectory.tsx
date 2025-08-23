
import React, { useEffect, useState } from 'react';
import { Search, Filter, Plus, User, Phone, Mail, Badge, Clock, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as UIBadge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useEmployee } from '@/contexts/EmployeeContext';
import { Employee } from '@/types/employee';
import EmployeeForm from './EmployeeForm';

const EmployeeDirectory: React.FC = () => {
  const {
    employees,
    pagination,
    loading,
    filters,
    loadEmployees,
    updateFilters,
    initializeEmployeeSystem
  } = useEmployee();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      await initializeEmployeeSystem();
      await loadEmployees();
    };
    initialize();
  }, []);

  // Handle search
  const handleSearch = (searchTerm: string) => {
    updateFilters({ searchTerm });
    loadEmployees({ searchTerm }, 1);
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    updateFilters(newFilters);
    loadEmployees(newFilters, 1);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    loadEmployees(filters, page);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':return 'bg-green-100 text-green-800 border-green-300';
      case 'Inactive':return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'Suspended':return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Terminated':return 'bg-red-100 text-red-800 border-red-300';
      default:return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin':return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Manager':return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Employee':return 'bg-green-100 text-green-800 border-green-300';
      default:return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Employee Directory</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <EmployeeForm
              onSuccess={() => {
                setIsCreateDialogOpen(false);
                loadEmployees();
              }}
              onCancel={() => setIsCreateDialogOpen(false)} />

          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search employees..."
                  value={filters.searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10" />

              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filters.role} onValueChange={(value) => handleFilterChange('role', value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Roles</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Department..."
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className="w-[140px]" />

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Grid */}
      {loading ?
      <div className="text-center py-8">Loading employees...</div> :
      employees.length === 0 ?
      <Card>
          <CardContent className="text-center py-12">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-600 mb-4">Get started by adding your first employee.</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </CardContent>
        </Card> :

      <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map((employee) =>
          <Card key={employee.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={employee.profile_picture_url} />
                        <AvatarFallback>
                          {employee.first_name[0]}{employee.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {employee.first_name} {employee.last_name}
                        </h3>
                        <p className="text-sm text-gray-600">{employee.position}</p>
                        <p className="text-xs text-gray-500">ID: {employee.employee_id}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setSelectedEmployee(employee)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit Profile</DropdownMenuItem>
                        <DropdownMenuItem>Time Tracking</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2" />
                      {employee.email}
                    </div>
                    {employee.phone &&
                <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2" />
                        {employee.phone}
                      </div>
                }
                    {employee.department &&
                <div className="flex items-center text-sm text-gray-600">
                        <Badge className="h-4 w-4 mr-2" />
                        {employee.department}
                      </div>
                }
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <UIBadge className={getRoleColor(employee.role)}>
                        {employee.role}
                      </UIBadge>
                      <UIBadge className={getStatusColor(employee.status)}>
                        {employee.status}
                      </UIBadge>
                    </div>
                    {employee.is_clocked_in ?
                <div className="flex items-center text-green-600 text-sm">
                        <Clock className="h-4 w-4 mr-1" />
                        Clocked In
                      </div> :
                null}
                  </div>

                  {employee.total_photo_ids &&
              <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-gray-600">
                        {employee.verified_photo_ids}/{employee.total_photo_ids} IDs verified
                      </div>
                    </div>
              }
                </CardContent>
              </Card>
          )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 &&
        <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  {pagination.page > 1 &&
              <PaginationItem>
                      <PaginationPrevious
                  onClick={() => handlePageChange(pagination.page - 1)}
                  className="cursor-pointer" />

                    </PaginationItem>
              }
                  
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <PaginationItem key={page}>
                        <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={page === pagination.page}
                      className="cursor-pointer">

                          {page}
                        </PaginationLink>
                      </PaginationItem>);

              })}
                  
                  {pagination.page < pagination.totalPages &&
              <PaginationItem>
                      <PaginationNext
                  onClick={() => handlePageChange(pagination.page + 1)}
                  className="cursor-pointer" />

                    </PaginationItem>
              }
                </PaginationContent>
              </Pagination>
            </div>
        }
        </>
      }
    </div>);

};

export default EmployeeDirectory;