/**
 * Application-level database types.
 *
 * These mirror the SQL migrations in /supabase/migrations. They are written by
 * hand (instead of generated) so the frontend compiles without a live project.
 * Object types are declared with `type` (not `interface`) because Supabase's
 * generic helpers require `Record<string, unknown>` compatibility.
 *
 * If the schema changes, run `supabase gen types typescript` and merge.
 */

export type UserRole = 'customer' | 'staff' | 'owner';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type InvoiceStatus = 'unpaid' | 'paid' | 'void';

/* -------------------------------------------------------------------------- */
/* Table rows                                                                 */
/* -------------------------------------------------------------------------- */

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  active: boolean;
  created_at: string;
};

export type StaffAvailability = {
  id: string;
  staff_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: string;
};

export type Appointment = {
  id: string;
  customer_id: string;
  staff_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  quantity: number;
  reorder_level: number;
  unit_price: number;
  expiry_date: string | null;
  supplier: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryMovement = {
  id: string;
  item_id: string;
  change: number;
  reason: string;
  created_by: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  appointment_id: string | null;
  customer_id: string;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

/* -------------------------------------------------------------------------- */
/* View rows                                                                  */
/* -------------------------------------------------------------------------- */

export type LowStockItem = InventoryItem & {
  units_needed: number;
};

export type ExpiringSoonItem = InventoryItem & {
  days_until_expiry: number;
};

export type DailyRevenue = {
  day: string;
  revenue: number;
  invoice_count: number;
};

export type BusiestHour = {
  hour: number;
  appointments: number;
};

export type AvailableSlot = {
  slot_start: string;
  slot_end: string;
};

/* -------------------------------------------------------------------------- */
/* Joined rows used by the UI                                                 */
/* -------------------------------------------------------------------------- */

export type AppointmentWithRelations = Appointment & {
  service: Pick<Service, 'id' | 'name' | 'duration_minutes' | 'price'> | null;
  staff: Pick<Profile, 'id' | 'full_name'> | null;
  customer: Pick<Profile, 'id' | 'full_name' | 'phone'> | null;
};

export type InvoiceWithRelations = Invoice & {
  customer: Pick<Profile, 'id' | 'full_name' | 'phone'> | null;
  appointment: Pick<Appointment, 'id' | 'starts_at'> | null;
  invoice_items: InvoiceItem[];
};

/* -------------------------------------------------------------------------- */
/* Insert / update payloads                                                   */
/* -------------------------------------------------------------------------- */

export type ProfileInsert = {
  id: string;
  full_name: string;
  phone?: string | null;
  role?: UserRole;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = {
  full_name?: string;
  phone?: string | null;
  role?: UserRole;
  updated_at?: string;
};

export type ServiceInsert = {
  id?: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number;
  active?: boolean;
  created_at?: string;
};

export type ServiceUpdate = {
  name?: string;
  description?: string | null;
  duration_minutes?: number;
  price?: number;
  active?: boolean;
};

export type StaffAvailabilityInsert = {
  id?: string;
  staff_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at?: string;
};

export type AppointmentInsert = {
  id?: string;
  customer_id: string;
  staff_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status?: AppointmentStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AppointmentUpdate = {
  starts_at?: string;
  ends_at?: string;
  staff_id?: string;
  service_id?: string;
  status?: AppointmentStatus;
  notes?: string | null;
  updated_at?: string;
};

export type InventoryItemInsert = {
  id?: string;
  name: string;
  sku: string;
  category?: string | null;
  quantity?: number;
  reorder_level?: number;
  unit_price?: number;
  expiry_date?: string | null;
  supplier?: string | null;
};

export type InventoryItemUpdate = {
  name?: string;
  sku?: string;
  category?: string | null;
  quantity?: number;
  reorder_level?: number;
  unit_price?: number;
  expiry_date?: string | null;
  supplier?: string | null;
};

export type InventoryMovementInsert = {
  id?: string;
  item_id: string;
  change: number;
  reason: string;
  created_by?: string | null;
};

export type InvoiceInsert = {
  id?: string;
  appointment_id?: string | null;
  customer_id: string;
  subtotal: number;
  tax: number;
  status?: InvoiceStatus;
};

export type InvoiceUpdate = {
  status?: InvoiceStatus;
  appointment_id?: string | null;
};

export type InvoiceItemInsert = {
  id?: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

export type AuditLogInsert = {
  id?: string;
  user_id?: string | null;
  action: string;
  table_name: string;
  record_id?: string | null;
  details?: Record<string, unknown> | null;
};

/* -------------------------------------------------------------------------- */
/* Supabase Database generic                                                  */
/* -------------------------------------------------------------------------- */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
      services: {
        Row: Service;
        Insert: ServiceInsert;
        Update: ServiceUpdate;
        Relationships: [];
      };
      staff_availability: {
        Row: StaffAvailability;
        Insert: StaffAvailabilityInsert;
        Update: Omit<StaffAvailabilityInsert, 'id' | 'staff_id'>;
        Relationships: [];
      };
      appointments: {
        Row: Appointment;
        Insert: AppointmentInsert;
        Update: AppointmentUpdate;
        Relationships: [];
      };
      inventory_items: {
        Row: InventoryItem;
        Insert: InventoryItemInsert;
        Update: InventoryItemUpdate;
        Relationships: [];
      };
      inventory_movements: {
        Row: InventoryMovement;
        Insert: InventoryMovementInsert;
        Update: never;
        Relationships: [];
      };
      invoices: {
        Row: Invoice;
        Insert: InvoiceInsert;
        Update: InvoiceUpdate;
        Relationships: [];
      };
      invoice_items: {
        Row: InvoiceItem;
        Insert: InvoiceItemInsert;
        Update: { description?: string; quantity?: number; unit_price?: number };
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: AuditLogInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      low_stock_items: { Row: LowStockItem; Relationships: [] };
      expiring_soon_items: { Row: ExpiringSoonItem; Relationships: [] };
      daily_revenue: { Row: DailyRevenue; Relationships: [] };
      busiest_hours: { Row: BusiestHour; Relationships: [] };
    };
    Functions: {
      get_my_role: { Args: Record<string, never>; Returns: UserRole };
      get_available_slots: {
        Args: { p_service_id: string; p_staff_id: string; p_date: string };
        Returns: AvailableSlot[];
      };
      book_appointment: {
        Args: {
          p_service_id: string;
          p_staff_id: string;
          p_starts_at: string;
          p_notes?: string | null;
        };
        Returns: Appointment;
      };
      cancel_appointment: {
        Args: { p_appointment_id: string };
        Returns: Appointment;
      };
      create_invoice: {
        Args: {
          p_customer_id: string;
          p_appointment_id: string | null;
          p_tax_rate: number;
          p_items: Array<{ description: string; quantity: number; unit_price: number }>;
        };
        Returns: Invoice;
      };
    };
    Enums: {
      user_role: UserRole;
      appointment_status: AppointmentStatus;
      invoice_status: InvoiceStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
