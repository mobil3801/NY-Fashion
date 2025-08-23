
export interface Employee {
  id?: number;
  user_id?: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  hire_date: string;
  role: 'Employee' | 'Manager' | 'Admin';
  status: 'Active' | 'Inactive' | 'Suspended' | 'Terminated';
  department?: string;
  position?: string;
  salary?: number;
  profile_picture_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  total_photo_ids?: number;
  verified_photo_ids?: number;
  is_clocked_in?: number;
}

export interface PhotoId {
  id?: number;
  employee_id: number;
  id_type: 'Drivers License' | 'Passport' | 'National ID' | 'Work Permit' | 'Other';
  id_number: string;
  id_number_masked?: string;
  front_image_url: string;
  back_image_url?: string;
  issue_date?: string;
  expiry_date?: string;
  is_primary: boolean;
  is_verified: boolean;
  verified_by?: number;
  verified_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TimeEntry {
  id?: number;
  employee_id: number;
  clock_in_time: string;
  clock_out_time?: string;
  break_start_time?: string;
  break_end_time?: string;
  total_hours?: number;
  break_hours?: number;
  notes?: string;
  location?: string;
  adjusted_by?: number;
  adjustment_reason?: string;
  adjustment_date?: string;
  created_at?: string;
  updated_at?: string;
  first_name?: string;
  last_name?: string;
  employee_id_display?: string;
  adjusted_by_name?: string;
  adjusted_by_lastname?: string;
}

export interface TimeTrackingStatus {
  id?: number;
  employee_id: number;
  clock_in_time: string;
  break_start_time?: string;
  break_end_time?: string;
  status: 'clocked_in' | 'on_break' | 'clocked_out';
}

export interface EmployeeFilters {
  searchTerm: string;
  role: string;
  status: string;
  department: string;
}

export interface EmployeePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}