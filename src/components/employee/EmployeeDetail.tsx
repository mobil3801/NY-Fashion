
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Clock, Shield, User, Phone, Mail, Calendar, MapPin, Building, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEmployee } from '@/contexts/EmployeeContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import EmployeeForm from './EmployeeForm';
import PhotoIdManagement from './PhotoIdManagement';
import TimeTracking from './TimeTracking';

interface EmployeeDetailProps {
  employeeId: string | number;
  onBack?: () => void;
}

const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employeeId, onBack }) => {
  const { currentEmployee, photoIds, loadEmployee, clearCurrentEmployee } = useEmployee();
  const { user } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const canManageEmployees = hasPermission(user?.role || '', 'manage_employee_profiles');

  useEffect(() => {
    loadEmployee(employeeId);
    return () => clearCurrentEmployee();
  }, [employeeId]);

  if (!currentEmployee) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading employee details...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 border-green-300';
      case 'Inactive': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'Suspended': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Terminated': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Manager': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Employee': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString?: string) => {
    return dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={currentEmployee.profile_picture_url} />
              <AvatarFallback className="text-lg">
                {currentEmployee.first_name[0]}{currentEmployee.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">
                {currentEmployee.first_name} {currentEmployee.last_name}
              </h1>
              <p className="text-gray-600">{currentEmployee.position}</p>
              <p className="text-sm text-gray-500">ID: {currentEmployee.employee_id}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Badge className={getRoleColor(currentEmployee.role)}>
              {currentEmployee.role}
            </Badge>
            <Badge className={getStatusColor(currentEmployee.status)}>
              {currentEmployee.status}
            </Badge>
          </div>
          {canManageEmployees && (
            <Button onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Employee Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {currentEmployee.verified_photo_ids || 0}
                </p>
                <p className="text-sm text-gray-600">Verified IDs</p>
              </div>
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {currentEmployee.total_photo_ids || 0}
                </p>
                <p className="text-sm text-gray-600">Total IDs</p>
              </div>
              <User className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {currentEmployee.is_clocked_in ? 'Clocked In' : 'Clocked Out'}
                </p>
                <p className="text-sm text-gray-600">Current Status</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="photo-ids">Photo IDs</TabsTrigger>
          <TabsTrigger value="time-tracking">Time Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p>{currentEmployee.email}</p>
                  </div>
                </div>
                
                {currentEmployee.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p>{currentEmployee.phone}</p>
                    </div>
                  </div>
                )}

                {currentEmployee.date_of_birth && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Date of Birth</p>
                      <p>{formatDate(currentEmployee.date_of_birth)}</p>
                    </div>
                  </div>
                )}

                {currentEmployee.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p>{currentEmployee.address}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employment Information */}
            <Card>
              <CardHeader>
                <CardTitle>Employment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Hire Date</p>
                    <p>{formatDate(currentEmployee.hire_date)}</p>
                  </div>
                </div>

                {currentEmployee.department && (
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Department</p>
                      <p>{currentEmployee.department}</p>
                    </div>
                  </div>
                )}

                {currentEmployee.salary && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Salary</p>
                      <p>${currentEmployee.salary.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Emergency Contact */}
                {(currentEmployee.emergency_contact_name || currentEmployee.emergency_contact_phone) && (
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">Emergency Contact</p>
                    {currentEmployee.emergency_contact_name && (
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Name</p>
                          <p>{currentEmployee.emergency_contact_name}</p>
                        </div>
                      </div>
                    )}
                    {currentEmployee.emergency_contact_phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Phone</p>
                          <p>{currentEmployee.emergency_contact_phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {currentEmployee.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">Notes</p>
                      <p className="text-sm text-gray-600">{currentEmployee.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="photo-ids">
          <PhotoIdManagement 
            employeeId={currentEmployee.id!} 
            photoIds={photoIds}
          />
        </TabsContent>

        <TabsContent value="time-tracking">
          <TimeTracking employee={currentEmployee} />
        </TabsContent>
      </Tabs>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            employee={currentEmployee}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              loadEmployee(employeeId);
            }}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeDetail;
