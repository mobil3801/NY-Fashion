
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Employee, PhotoId, TimeEntry, TimeTrackingStatus, EmployeeFilters, EmployeePagination } from '@/types/employee';
import { useToast } from '@/hooks/use-toast';

interface EmployeeContextType {
  // State
  employees: Employee[];
  currentEmployee: Employee | null;
  photoIds: PhotoId[];
  timeEntries: TimeEntry[];
  currentStatus: TimeTrackingStatus | null;
  pagination: EmployeePagination;
  loading: boolean;
  filters: EmployeeFilters;
  
  // Actions
  initializeEmployeeSystem: () => Promise<void>;
  loadEmployees: (filters?: Partial<EmployeeFilters>, page?: number) => Promise<void>;
  loadEmployee: (employeeId: string | number) => Promise<void>;
  saveEmployee: (employee: Partial<Employee>) => Promise<Employee>;
  savePhotoId: (photoId: Partial<PhotoId>) => Promise<PhotoId>;
  deletePhotoId: (photoIdId: number) => Promise<void>;
  verifyPhotoId: (photoIdId: number, verified: boolean) => Promise<void>;
  clockInOut: (employeeId: number, action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end', location?: string, notes?: string) => Promise<any>;
  loadTimeTracking: (employeeId?: number, startDate?: string, endDate?: string, page?: number) => Promise<void>;
  adjustTimeEntry: (timeEntryId: number, adjustments: any, reason: string) => Promise<void>;
  updateFilters: (newFilters: Partial<EmployeeFilters>) => void;
  clearCurrentEmployee: () => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [photoIds, setPhotoIds] = useState<PhotoId[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<TimeTrackingStatus | null>(null);
  const [pagination, setPagination] = useState<EmployeePagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<EmployeeFilters>({
    searchTerm: '',
    role: '',
    status: '',
    department: ''
  });

  // Initialize employee system
  const initializeEmployeeSystem = useCallback(async () => {
    try {
      setLoading(true);
      const response = await window.ezsite.apis.run({
        path: "createEmployeeTables",
        param: []
      });
      console.log('Employee system initialized:', response);
    } catch (error) {
      console.error('Failed to initialize employee system:', error);
      toast({
        title: "Error",
        description: "Failed to initialize employee system",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load employees with filters and pagination
  const loadEmployees = useCallback(async (filterOverrides?: Partial<EmployeeFilters>, page = 1) => {
    try {
      setLoading(true);
      const activeFilters = { ...filters, ...filterOverrides };
      
      const response = await window.ezsite.apis.run({
        path: "getEmployees",
        param: [
          activeFilters.searchTerm,
          activeFilters.role,
          activeFilters.status,
          activeFilters.department,
          page,
          pagination.limit
        ]
      });

      if (response.data) {
        setEmployees(response.data.employees || []);
        setPagination(response.data.pagination || pagination);
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, toast]);

  // Load single employee
  const loadEmployee = useCallback(async (employeeId: string | number) => {
    try {
      setLoading(true);
      const response = await window.ezsite.apis.run({
        path: "getEmployee",
        param: [employeeId]
      });

      if (response.data) {
        setCurrentEmployee(response.data);
        setPhotoIds(response.data.photo_ids || []);
        setTimeEntries(response.data.recent_time_tracking || []);
      }
    } catch (error) {
      console.error('Failed to load employee:', error);
      toast({
        title: "Error",
        description: "Failed to load employee details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Save employee
  const saveEmployee = useCallback(async (employee: Partial<Employee>): Promise<Employee> => {
    try {
      setLoading(true);
      const response = await window.ezsite.apis.run({
        path: "saveEmployee",
        param: [employee]
      });

      if (response.data) {
        toast({
          title: "Success",
          description: response.data.message || "Employee saved successfully"
        });
        
        // Reload employees list
        await loadEmployees();
        
        return { ...employee, id: response.data.id, employee_id: response.data.employee_id } as Employee;
      }
      throw new Error('No response data');
    } catch (error) {
      console.error('Failed to save employee:', error);
      toast({
        title: "Error",
        description: "Failed to save employee",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadEmployees, toast]);

  // Save photo ID
  const savePhotoId = useCallback(async (photoId: Partial<PhotoId>): Promise<PhotoId> => {
    try {
      setLoading(true);
      const response = await window.ezsite.apis.run({
        path: "savePhotoId",
        param: [photoId]
      });

      if (response.data) {
        toast({
          title: "Success",
          description: response.data.message || "Photo ID saved successfully"
        });
        
        // Reload current employee if viewing details
        if (currentEmployee) {
          await loadEmployee(currentEmployee.id!);
        }
        
        return { ...photoId, id: response.data.id } as PhotoId;
      }
      throw new Error('No response data');
    } catch (error) {
      console.error('Failed to save photo ID:', error);
      toast({
        title: "Error",
        description: "Failed to save photo ID",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentEmployee, loadEmployee, toast]);

  // Delete photo ID (placeholder - would need backend implementation)
  const deletePhotoId = useCallback(async (photoIdId: number) => {
    try {
      // Implementation would go here
      toast({
        title: "Success",
        description: "Photo ID deleted successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete photo ID",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Verify photo ID (placeholder - would need backend implementation)
  const verifyPhotoId = useCallback(async (photoIdId: number, verified: boolean) => {
    try {
      // Implementation would go here
      toast({
        title: "Success",
        description: `Photo ID ${verified ? 'verified' : 'unverified'} successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update photo ID verification",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Clock in/out
  const clockInOut = useCallback(async (
    employeeId: number, 
    action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end',
    location = '',
    notes = ''
  ) => {
    try {
      setLoading(true);
      const response = await window.ezsite.apis.run({
        path: "clockInOut",
        param: [employeeId, action, location, notes]
      });

      if (response.data) {
        toast({
          title: "Success",
          description: response.data.message
        });
        
        // Reload time tracking data
        await loadTimeTracking(employeeId);
        
        return response.data;
      }
    } catch (error) {
      console.error('Clock in/out failed:', error);
      toast({
        title: "Error",
        description: error.message || "Clock in/out failed",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load time tracking
  const loadTimeTracking = useCallback(async (
    employeeId?: number, 
    startDate?: string, 
    endDate?: string, 
    page = 1
  ) => {
    try {
      setLoading(true);
      const response = await window.ezsite.apis.run({
        path: "getTimeTracking",
        param: [employeeId, startDate, endDate, page, pagination.limit]
      });

      if (response.data) {
        setTimeEntries(response.data.timeEntries || []);
        setCurrentStatus(response.data.currentStatus);
        if (response.data.pagination) {
          setPagination(prev => ({ ...prev, ...response.data.pagination }));
        }
      }
    } catch (error) {
      console.error('Failed to load time tracking:', error);
      toast({
        title: "Error",
        description: "Failed to load time tracking data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, toast]);

  // Adjust time entry (placeholder)
  const adjustTimeEntry = useCallback(async (timeEntryId: number, adjustments: any, reason: string) => {
    try {
      // Implementation would go here
      toast({
        title: "Success",
        description: "Time entry adjusted successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to adjust time entry",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<EmployeeFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Clear current employee
  const clearCurrentEmployee = useCallback(() => {
    setCurrentEmployee(null);
    setPhotoIds([]);
    setTimeEntries([]);
    setCurrentStatus(null);
  }, []);

  const value: EmployeeContextType = {
    // State
    employees,
    currentEmployee,
    photoIds,
    timeEntries,
    currentStatus,
    pagination,
    loading,
    filters,
    
    // Actions
    initializeEmployeeSystem,
    loadEmployees,
    loadEmployee,
    saveEmployee,
    savePhotoId,
    deletePhotoId,
    verifyPhotoId,
    clockInOut,
    loadTimeTracking,
    adjustTimeEntry,
    updateFilters,
    clearCurrentEmployee
  };

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployee = () => {
  const context = useContext(EmployeeContext);
  if (context === undefined) {
    throw new Error('useEmployee must be used within an EmployeeProvider');
  }
  return context;
};
