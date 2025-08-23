
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar, Upload, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FormField } from '@/components/ui/form-field';
import { useEmployee } from '@/contexts/EmployeeContext';
import { Employee } from '@/types/employee';
import { useDropzone } from 'react-dropzone';

interface EmployeeFormProps {
  employee?: Employee;
  onSuccess?: (employee: Employee) => void;
  onCancel?: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  employee,
  onSuccess,
  onCancel
}) => {
  const { saveEmployee, loading } = useEmployee();
  const [profileImage, setProfileImage] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<Employee>({
    defaultValues: employee || {
      employee_id: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      date_of_birth: '',
      hire_date: new Date().toISOString().split('T')[0],
      role: 'Employee',
      status: 'Active',
      department: '',
      position: '',
      salary: 0,
      emergency_contact_name: '',
      emergency_contact_phone: '',
      notes: ''
    }
  });

  useEffect(() => {
    if (employee) {
      reset(employee);
      setProfileImage(employee.profile_picture_url || '');
    }
  }, [employee, reset]);

  // Handle profile image upload
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // In a real implementation, you would upload to EasySite Storage
      // For now, we'll create a local URL
      const url = URL.createObjectURL(file);
      setProfileImage(url);
      setValue('profile_picture_url', url);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  const onSubmit = async (data: Employee) => {
    try {
      const savedEmployee = await saveEmployee({
        ...data,
        profile_picture_url: profileImage
      });

      if (onSuccess) {
        onSuccess(savedEmployee);
      }
    } catch (error) {
      console.error('Failed to save employee:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Picture */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profile Picture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profileImage} />
                <AvatarFallback>
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                  focus-visible-aa interactive-aa
                  ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                `}
                role="button"
                tabIndex={0}
                aria-label="Upload profile picture">

                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-aa" aria-hidden="true" />
                <p className="text-small-aa">
                  {isDragActive ? 'Drop image here' : 'Click or drag image here'}
                </p>
                <p className="text-xs-aa mt-1">PNG, JPG up to 5MB</p>
              </div>
              
              {profileImage &&
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setProfileImage('');
                  setValue('profile_picture_url', '');
                }}>

                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              }
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Employee ID"
                description="Leave empty for auto-generation">

                <Input
                  {...register('employee_id')}
                  placeholder="Auto-generated if empty"
                  className="focus-visible-aa" />

              </FormField>
              
              <FormField
                label="Email"
                error={errors.email?.message}
                required
                description="Work email address for notifications">

                <Input
                  type="email"
                  {...register('email', { required: 'Email is required' })}
                  className="focus-visible-aa" />

              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="First Name"
                error={errors.first_name?.message}
                required>

                <Input
                  {...register('first_name', { required: 'First name is required' })}
                  className="focus-visible-aa" />

              </FormField>
              
              <FormField
                label="Last Name"
                error={errors.last_name?.message}
                required>

                <Input
                  {...register('last_name', { required: 'Last name is required' })}
                  className="focus-visible-aa" />

              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register('phone')} />

              </div>
              
              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  {...register('date_of_birth')} />

              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                {...register('address')}
                rows={3} />

            </div>
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="hire_date">Hire Date *</Label>
                <Input
                  id="hire_date"
                  type="date"
                  {...register('hire_date', { required: 'Hire date is required' })}
                  className={errors.hire_date ? 'border-red-500' : ''} />

                {errors.hire_date &&
                <p className="text-red-500 text-sm mt-1">{errors.hire_date.message}</p>
                }
              </div>
              
              <div>
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={watch('role')}
                  onValueChange={(value) => setValue('role', value as any)}>

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) => setValue('status', value as any)}>

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="salary">Salary</Label>
                <Input
                  id="salary"
                  type="number"
                  step="0.01"
                  {...register('salary', { valueAsNumber: true })} />

              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  {...register('department')} />

              </div>
              
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  {...register('position')} />

              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emergency_contact_name">Contact Name</Label>
                <Input
                  id="emergency_contact_name"
                  {...register('emergency_contact_name')} />

              </div>
              
              <div>
                <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                <Input
                  id="emergency_contact_phone"
                  {...register('emergency_contact_phone')} />

              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                rows={3}
                placeholder="Any additional notes about the employee..." />

            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        {onCancel &&
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="btn-outline-aa focus-visible-aa touch-target-aa">

            Cancel
          </Button>
        }
        <Button
          type="submit"
          disabled={loading}
          className="focus-visible-aa touch-target-aa"
          aria-describedby={loading ? "saving-status" : undefined}>

          {loading ? 'Saving...' : employee ? 'Update Employee' : 'Create Employee'}
          {loading && <span id="saving-status" className="sr-only">Form is being saved</span>}
        </Button>
      </div>
    </form>);

};

export default EmployeeForm;