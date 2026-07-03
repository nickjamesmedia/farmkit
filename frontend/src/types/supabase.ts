// Auto-generated-style Supabase types (manually curated for now)

export type Farm = {
  id: string;
  name: string;
  slug: string;
  parent_farm_id: string | null;
  timezone: string;
  status: 'active' | 'archived';
  created_at: string;
  created_by_auth_user_id: string | null;
};

export type FarmDetails = {
  farm_id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  app_url: string | null;
  favicon_url: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by_auth_user_id: string | null;
};

export type FarmErp = {
  farm_id: string;
  nearest_town: string | null;
  nearest_hospital_name: string | null;
  nearest_hospital_distance_km: number | null;
  emergency_instructions: string | null;
  has_fuel_storage: boolean | null;
  has_chemical_storage: boolean | null;
  created_at: string;
  updated_at: string | null;
  updated_by_auth_user_id: string | null;
};

export type Container = {
  id: string;
  farm_id: string;
  parent_id: string | null;
  container_kind: string;
  name: string;
  code: string | null;
  description: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  created_by_auth_user_id: string | null;
  updated_at: string | null;
  updated_by_auth_user_id: string | null;
};

export type BuildingDetails = {
  container_id: string;
  year_built: number | null;
  heated: boolean | null;
  has_water: boolean | null;
  has_three_phase_power: boolean | null;
  capacity: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by_auth_user_id: string | null;
};

export type Equipment = {
  id: string;
  farm_id: string;
  home_container_id: string | null;
  current_container_id: string | null;
  category: string | null;
  make: string | null;
  model: string | null;
  nickname: string | null;
  serial_number: string | null;
  vin_sn: string | null;
  unit_number: string | null;
  year: number | null;
  year_of_purchase: number | null;
  license_class: string | null;
  next_service_at: string | null;
  cvip_expires_at: string | null;
  insurance_expires_at: string | null;
  oil_filter_number: string | null;
  fuel_filter_number: string | null;
  air_filter_number: string | null;
  active: boolean | null;
  notes: string | null;
  created_at: string;
  created_by_auth_user_id: string | null;
  updated_at: string | null;
  updated_by_auth_user_id: string | null;
};

export type MaintenanceLog = {
  id: string;
  farm_id: string;
  equipment_id: string | null;
  container_id: string | null;
  created_by_auth_user_id: string | null;
  entered_by_person_id: string | null;
  title: string;
  description: string | null;
  status: 'open' | 'closed';
  logged_at: string;
  maintenance_date: string | null;
  hours_on_meter: number | null;
  next_due_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type UserProfile = {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  default_farm_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type FarmMembership = {
  id: string;
  farm_id: string;
  auth_user_id: string;
  role_id: string;
  status: 'active' | 'invited' | 'disabled';
  account_mode: 'personal' | 'shared';
  person_id: string | null;
  display_name_override: string | null;
  created_at: string;
  created_by_auth_user_id: string | null;
  last_seen_at: string | null;
};

export type Person = {
  id: string;
  farm_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Role = {
  id: string;
  key: 'admin' | 'manager' | 'user';
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
};
