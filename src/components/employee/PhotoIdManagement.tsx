
import React, { useState } from 'react';
import { Upload, Eye, Shield, ShieldCheck, Calendar, Plus, Edit, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useDropzone } from 'react-dropzone';
import { useEmployee } from '@/contexts/EmployeeContext';
import { PhotoId } from '@/types/employee';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { toast } from '@/hooks/use-toast';

interface PhotoIdManagementProps {
  employeeId: number;
  photoIds: PhotoId[];
}

const PhotoIdManagement: React.FC<PhotoIdManagementProps> = ({ employeeId, photoIds }) => {
  const { savePhotoId, deletePhotoId, verifyPhotoId, loading } = useEmployee();
  const { user } = useAuth();
  const [selectedPhotoId, setSelectedPhotoId] = useState<PhotoId | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [frontImage, setFrontImage] = useState<string>('');
  const [backImage, setBackImage] = useState<string>('');
  const [formData, setFormData] = useState<Partial<PhotoId>>({
    employee_id: employeeId,
    id_type: 'Drivers License',
    id_number: '',
    issue_date: '',
    expiry_date: '',
    is_primary: false,
    notes: ''
  });

  const canManageIds = hasPermission(user?.role || '', 'manage_employee_ids');
  const canVerifyIds = hasPermission(user?.role || '', 'verify_ids');

  const handleOpenDialog = (photoId?: PhotoId) => {
    if (photoId) {
      setSelectedPhotoId(photoId);
      setFormData(photoId);
      setFrontImage(photoId.front_image_url);
      setBackImage(photoId.back_image_url || '');
    } else {
      setSelectedPhotoId(null);
      setFormData({
        employee_id: employeeId,
        id_type: 'Drivers License',
        id_number: '',
        issue_date: '',
        expiry_date: '',
        is_primary: false,
        notes: ''
      });
      setFrontImage('');
      setBackImage('');
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedPhotoId(null);
    setFrontImage('');
    setBackImage('');
  };

  // Front image upload
  const onDropFront = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      try {
        // Validate file
        const validationResult = await window.ezsite.apis.run({
          path: 'validateFileUpload',
          param: [file, 'employee_photo']
        });

        if (validationResult.error) {
          toast({
            title: "Validation Error",
            description: validationResult.error,
            variant: "destructive"
          });
          return;
        }

        // Upload to EasySite Storage
        const uploadResult = await window.ezsite.apis.upload({
          filename: `employee_${employeeId}_front_${Date.now()}.${file.name.split('.').pop()}`,
          file: file
        });

        if (uploadResult.error) {
          throw new Error(uploadResult.error);
        }

        // Get file URL
        const urlResult = await window.ezsite.apis.getUploadUrl(uploadResult.data);
        if (urlResult.error) {
          throw new Error(urlResult.error);
        }

        setFrontImage(urlResult.data);
        setFormData((prev) => ({ ...prev, front_file_id: uploadResult.data }));

        toast({
          title: "Success",
          description: "Front image uploaded successfully"
        });

      } catch (error: any) {
        toast({
          title: "Upload Error",
          description: error.message || "Failed to upload front image",
          variant: "destructive"
        });
      }
    }
  };

  const { getRootProps: getFrontRootProps, getInputProps: getFrontInputProps, isDragActive: isFrontDragActive } = useDropzone({
    onDrop: onDropFront,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  // Back image upload
  const onDropBack = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      try {
        // Validate file
        const validationResult = await window.ezsite.apis.run({
          path: 'validateFileUpload',
          param: [file, 'employee_photo']
        });

        if (validationResult.error) {
          toast({
            title: "Validation Error",
            description: validationResult.error,
            variant: "destructive"
          });
          return;
        }

        // Upload to EasySite Storage
        const uploadResult = await window.ezsite.apis.upload({
          filename: `employee_${employeeId}_back_${Date.now()}.${file.name.split('.').pop()}`,
          file: file
        });

        if (uploadResult.error) {
          throw new Error(uploadResult.error);
        }

        // Get file URL
        const urlResult = await window.ezsite.apis.getUploadUrl(uploadResult.data);
        if (urlResult.error) {
          throw new Error(urlResult.error);
        }

        setBackImage(urlResult.data);
        setFormData((prev) => ({ ...prev, back_file_id: uploadResult.data }));

        toast({
          title: "Success",
          description: "Back image uploaded successfully"
        });

      } catch (error: any) {
        toast({
          title: "Upload Error",
          description: error.message || "Failed to upload back image",
          variant: "destructive"
        });
      }
    }
  };

  const { getRootProps: getBackRootProps, getInputProps: getBackInputProps, isDragActive: isBackDragActive } = useDropzone({
    onDrop: onDropBack,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const handleSubmit = async () => {
    if (!frontImage) {
      toast({
        title: "Validation Error",
        description: "Front image is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await window.ezsite.apis.run({
        path: 'uploadEmployeePhoto',
        param: [
        employeeId,
        formData,
        {
          frontImageUrl: frontImage,
          backImageUrl: backImage,
          frontFileId: formData.front_file_id,
          backFileId: formData.back_file_id
        }]

      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Success",
        description: result.data.message
      });

      handleCloseDialog();

      // Refresh the photo IDs list
      window.location.reload();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save photo ID",
        variant: "destructive"
      });
    }
  };

  const handleVerify = async (photoId: PhotoId, verified: boolean) => {
    try {
      await verifyPhotoId(photoId.id!, verified);
    } catch (error) {
      console.error('Failed to verify photo ID:', error);
    }
  };

  const getIdTypeColor = (type: string) => {
    const colors = {
      'Drivers License': 'bg-blue-100 text-blue-800 border-blue-300',
      'Passport': 'bg-purple-100 text-purple-800 border-purple-300',
      'National ID': 'bg-green-100 text-green-800 border-green-300',
      'Work Permit': 'bg-orange-100 text-orange-800 border-orange-300',
      'Other': 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[type as keyof typeof colors] || colors.Other;
  };

  const formatDate = (dateString?: string) => {
    return dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
  };

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Photo IDs</h2>
        {canManageIds &&
        <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add ID
          </Button>
        }
      </div>

      {photoIds.length === 0 ?
      <Card>
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No IDs uploaded</h3>
            <p className="text-gray-600 mb-4">Upload employee identification documents for verification.</p>
            {canManageIds &&
          <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add First ID
              </Button>
          }
          </CardContent>
        </Card> :

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {photoIds.map((photoId) =>
        <Card key={photoId.id} className={`${photoId.is_primary ? 'ring-2 ring-blue-500' : ''}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge className={getIdTypeColor(photoId.id_type)}>
                        {photoId.id_type}
                      </Badge>
                      {photoId.is_primary &&
                  <Badge variant="outline">Primary</Badge>
                  }
                    </CardTitle>
                    <div className="text-sm text-gray-600 mt-1">
                      ID: {photoId.id_number_masked}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canVerifyIds &&
                <Button
                  size="sm"
                  variant={photoId.is_verified ? "default" : "outline"}
                  onClick={() => handleVerify(photoId, !photoId.is_verified)}>

                        {photoId.is_verified ?
                  <ShieldCheck className="h-4 w-4" /> :

                  <Shield className="h-4 w-4" />
                  }
                      </Button>
                }
                    {canManageIds &&
                <>
                        <Button size="sm" variant="outline" onClick={() => handleOpenDialog(photoId)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deletePhotoId(photoId.id!)}>

                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                }
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Front Image</Label>
                    <div className="mt-1 aspect-[3/2] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                    src={photoId.front_image_url}
                    alt="ID Front"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                    onClick={() => window.open(photoId.front_image_url, '_blank')} />

                    </div>
                  </div>
                  {photoId.back_image_url &&
              <div>
                      <Label className="text-xs text-gray-500">Back Image</Label>
                      <div className="mt-1 aspect-[3/2] bg-gray-100 rounded-lg overflow-hidden">
                        <img
                    src={photoId.back_image_url}
                    alt="ID Back"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                    onClick={() => window.open(photoId.back_image_url, '_blank')} />

                      </div>
                    </div>
              }
                </div>

                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-4">
                    {photoId.issue_date &&
                <div className="text-gray-600">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Issued: {formatDate(photoId.issue_date)}
                      </div>
                }
                    {photoId.expiry_date &&
                <div className={`${isExpiringSoon(photoId.expiry_date) ? 'text-orange-600' : 'text-gray-600'}`}>
                        <Calendar className="h-4 w-4 inline mr-1" />
                        Expires: {formatDate(photoId.expiry_date)}
                        {isExpiringSoon(photoId.expiry_date) &&
                  <span className="ml-1 text-orange-600">⚠️</span>
                  }
                      </div>
                }
                  </div>
                  {photoId.is_verified ?
              <Badge className="bg-green-100 text-green-800 border-green-300">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Verified
                    </Badge> :

              <Badge variant="outline">
                      <Shield className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
              }
                </div>

                {photoId.notes &&
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {photoId.notes}
                  </div>
            }
              </CardContent>
            </Card>
        )}
        </div>
      }

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPhotoId ? 'Edit Photo ID' : 'Add Photo ID'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="id_type">ID Type *</Label>
                <Select
                  value={formData.id_type}
                  onValueChange={(value) => setFormData({ ...formData, id_type: value as any })}>

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Drivers License">Drivers License</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                    <SelectItem value="National ID">National ID</SelectItem>
                    <SelectItem value="Work Permit">Work Permit</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="id_number">ID Number *</Label>
                <Input
                  id="id_number"
                  value={formData.id_number}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                  placeholder="Enter ID number" />

              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} />

              </div>
              
              <div>
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} />

              </div>
            </div>

            {/* Primary ID Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })} />

              <Label htmlFor="is_primary">Set as Primary ID</Label>
            </div>

            {/* Image Uploads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Front Image */}
              <div>
                <Label>Front Image *</Label>
                <div
                  {...getFrontRootProps()}
                  className={`
                    mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                    ${isFrontDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                  `}>

                  <input {...getFrontInputProps()} />
                  {frontImage ?
                  <div className="relative">
                      <img src={frontImage} alt="Front preview" className="max-h-40 mx-auto rounded" />
                      <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFrontImage('');
                      }}>

                        <X className="h-4 w-4" />
                      </Button>
                    </div> :

                  <>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        {isFrontDragActive ? 'Drop front image here' : 'Click or drag front image here'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </>
                  }
                </div>
              </div>

              {/* Back Image */}
              <div>
                <Label>Back Image (Optional)</Label>
                <div
                  {...getBackRootProps()}
                  className={`
                    mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                    ${isBackDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                  `}>

                  <input {...getBackInputProps()} />
                  {backImage ?
                  <div className="relative">
                      <img src={backImage} alt="Back preview" className="max-h-40 mx-auto rounded" />
                      <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBackImage('');
                      }}>

                        <X className="h-4 w-4" />
                      </Button>
                    </div> :

                  <>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        {isBackDragActive ? 'Drop back image here' : 'Click or drag back image here'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </>
                  }
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this ID..."
                rows={3} />

            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading || !frontImage}>
                {loading ? 'Saving...' : selectedPhotoId ? 'Update ID' : 'Add ID'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

export default PhotoIdManagement;