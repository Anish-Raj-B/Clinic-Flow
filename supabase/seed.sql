-- ===========================================================================
-- ClinicFlow · Demo seed
-- ===========================================================================
-- Run with `supabase db reset` (local) or paste into the SQL editor after the
-- migrations have been applied.
--
-- Demo accounts (password for all of them: ClinicFlow123!)
--   owner@clinicflow.dev     owner
--   staff@clinicflow.dev     staff (Dr. Maya Chen)
--   nurse@clinicflow.dev     staff (Noah Patel, RN)
--   customer@clinicflow.dev  customer (Jordan Blake)
--   patient@clinicflow.dev   customer (Sam Rivera)
--
-- Change or delete these accounts before using the app with real data.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- Auth users (confirmed email so local login works immediately)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'owner@clinicflow.dev',
    crypt('ClinicFlow123!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Avery Morgan","phone":"+1 555 010 1001"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'staff@clinicflow.dev',
    crypt('ClinicFlow123!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Maya Chen","phone":"+1 555 010 1002"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'nurse@clinicflow.dev',
    crypt('ClinicFlow123!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Noah Patel, RN","phone":"+1 555 010 1003"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'customer@clinicflow.dev',
    crypt('ClinicFlow123!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Jordan Blake","phone":"+1 555 010 2001"}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555555',
    'authenticated', 'authenticated', 'patient@clinicflow.dev',
    crypt('ClinicFlow123!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Sam Rivera","phone":"+1 555 010 2002"}',
    '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555'
)
on conflict do nothing;

-- The auth trigger created the profiles; finalise names, phones and roles.
update public.profiles
set full_name = 'Avery Morgan', phone = '+1 555 010 1001', role = 'owner'
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set full_name = 'Dr. Maya Chen', phone = '+1 555 010 1002', role = 'staff'
where id = '22222222-2222-4222-8222-222222222222';

update public.profiles
set full_name = 'Noah Patel, RN', phone = '+1 555 010 1003', role = 'staff'
where id = '33333333-3333-4333-8333-333333333333';

update public.profiles
set full_name = 'Jordan Blake', phone = '+1 555 010 2001', role = 'customer'
where id = '44444444-4444-4444-8444-444444444444';

update public.profiles
set full_name = 'Sam Rivera', phone = '+1 555 010 2002', role = 'customer'
where id = '55555555-5555-4555-8555-555555555555';

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
insert into public.services (id, name, description, duration_minutes, price, active)
values
  (
    'aaaaaaa1-0000-4000-8000-000000000001',
    'General consultation',
    'Full assessment with a clinician, including basic vitals and a care plan.',
    30, 75.00, true
  ),
  (
    'aaaaaaa1-0000-4000-8000-000000000002',
    'Follow-up visit',
    'Short review of an existing treatment plan or test results.',
    20, 45.00, true
  ),
  (
    'aaaaaaa1-0000-4000-8000-000000000003',
    'Vaccination',
    'Routine immunisation administered by a nurse.',
    15, 30.00, true
  ),
  (
    'aaaaaaa1-0000-4000-8000-000000000004',
    'Blood pressure check',
    'Quick blood pressure and pulse check with a nurse.',
    15, 20.00, true
  ),
  (
    'aaaaaaa1-0000-4000-8000-000000000005',
    'Minor procedure',
    'Suturing, wound care or other minor in-clinic procedure.',
    60, 150.00, true
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Weekly availability (0 = Sunday … 6 = Saturday)
-- ---------------------------------------------------------------------------
insert into public.staff_availability (id, staff_id, weekday, start_time, end_time)
values
  ('bbbbbbb1-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, '09:00', '17:00'),
  ('bbbbbbb1-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 2, '09:00', '17:00'),
  ('bbbbbbb1-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 3, '09:00', '17:00'),
  ('bbbbbbb1-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 4, '09:00', '17:00'),
  ('bbbbbbb1-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 5, '09:00', '15:00'),
  ('bbbbbbb1-0000-4000-8000-000000000011', '22222222-2222-4222-8222-222222222222', 1, '08:30', '16:30'),
  ('bbbbbbb1-0000-4000-8000-000000000012', '22222222-2222-4222-8222-222222222222', 2, '08:30', '16:30'),
  ('bbbbbbb1-0000-4000-8000-000000000013', '22222222-2222-4222-8222-222222222222', 3, '08:30', '16:30'),
  ('bbbbbbb1-0000-4000-8000-000000000014', '22222222-2222-4222-8222-222222222222', 4, '08:30', '16:30'),
  ('bbbbbbb1-0000-4000-8000-000000000015', '22222222-2222-4222-8222-222222222222', 5, '08:30', '16:30'),
  ('bbbbbbb1-0000-4000-8000-000000000016', '22222222-2222-4222-8222-222222222222', 6, '09:00', '13:00'),
  ('bbbbbbb1-0000-4000-8000-000000000021', '33333333-3333-4333-8333-333333333333', 1, '10:00', '18:00'),
  ('bbbbbbb1-0000-4000-8000-000000000022', '33333333-3333-4333-8333-333333333333', 2, '10:00', '18:00'),
  ('bbbbbbb1-0000-4000-8000-000000000023', '33333333-3333-4333-8333-333333333333', 3, '10:00', '18:00'),
  ('bbbbbbb1-0000-4000-8000-000000000024', '33333333-3333-4333-8333-333333333333', 4, '10:00', '18:00'),
  ('bbbbbbb1-0000-4000-8000-000000000025', '33333333-3333-4333-8333-333333333333', 5, '10:00', '18:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
insert into public.inventory_items (
  id, name, sku, category, quantity, reorder_level, unit_price, expiry_date, supplier
)
values
  ('ccccccc1-0000-4000-8000-000000000001', 'Paracetamol 500mg (100 tablets)', 'MED-PARA-500', 'Medicine', 4, 10, 6.50, current_date + 220, 'MedSupply Co.'),
  ('ccccccc1-0000-4000-8000-000000000002', 'Surgical gloves (box of 100)', 'SUP-GLOVE-100', 'Supplies', 26, 15, 12.00, null, 'CleanCare Ltd.'),
  ('ccccccc1-0000-4000-8000-000000000003', 'Ibuprofen 200mg (50 tablets)', 'MED-IBU-200', 'Medicine', 48, 12, 4.20, current_date + 12, 'MedSupply Co.'),
  ('ccccccc1-0000-4000-8000-000000000004', 'Saline solution 500ml', 'SUP-SALINE-500', 'Supplies', 18, 8, 3.75, current_date + 400, 'CleanCare Ltd.'),
  ('ccccccc1-0000-4000-8000-000000000005', 'Sterile gauze pads', 'SUP-GAUZE-50', 'Supplies', 0, 20, 9.90, current_date + 25, 'CleanCare Ltd.'),
  ('ccccccc1-0000-4000-8000-000000000006', 'Influenza vaccine (single dose)', 'VAC-FLU-01', 'Vaccine', 12, 6, 15.00, current_date + 3, 'VaccineDirect'),
  ('ccccccc1-0000-4000-8000-000000000007', 'Alcohol swabs (200)', 'SUP-ALC-200', 'Supplies', 31, 10, 5.10, current_date + 180, 'CleanCare Ltd.'),
  ('ccccccc1-0000-4000-8000-000000000008', 'Cough syrup 100ml', 'MED-COUGH-100', 'Medicine', 7, 9, 8.40, current_date - 3, 'MedSupply Co.')
on conflict (id) do nothing;

insert into public.inventory_movements (id, item_id, change, reason, created_by)
values
  (
    'ddddddd1-0000-4000-8000-000000000001',
    'ccccccc1-0000-4000-8000-000000000001',
    -6, 'Dispensed to patients during the week', '22222222-2222-4222-8222-222222222222'
  ),
  (
    'ddddddd1-0000-4000-8000-000000000002',
    'ccccccc1-0000-4000-8000-000000000002',
    30, 'Delivery from CleanCare Ltd.', '33333333-3333-4333-8333-333333333333'
  ),
  (
    'ddddddd1-0000-4000-8000-000000000003',
    'ccccccc1-0000-4000-8000-000000000005',
    -10, 'Used during minor procedures', '33333333-3333-4333-8333-333333333333'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo appointments (times aligned with the weekly availability above)
-- ---------------------------------------------------------------------------
insert into public.appointments (
  id, customer_id, staff_id, service_id, starts_at, ends_at, status, notes
)
values
  (
    'eeeeeee1-0000-4000-8000-000000000001',
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaa1-0000-4000-8000-000000000002',
    ((current_date - 10)::timestamp + time '10:00') at time zone public.clinic_timezone(),
    ((current_date - 10)::timestamp + time '10:20') at time zone public.clinic_timezone(),
    'completed',
    'Follow-up on blood test results.'
  ),
  (
    'eeeeeee1-0000-4000-8000-000000000002',
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaa1-0000-4000-8000-000000000001',
    ((current_date + 1)::timestamp + time '09:00') at time zone public.clinic_timezone(),
    ((current_date + 1)::timestamp + time '09:30') at time zone public.clinic_timezone(),
    'confirmed',
    'New patient consultation.'
  ),
  (
    'eeeeeee1-0000-4000-8000-000000000003',
    '55555555-5555-4555-8555-555555555555',
    '33333333-3333-4333-8333-333333333333',
    'aaaaaaa1-0000-4000-8000-000000000003',
    ((current_date + 1)::timestamp + time '11:00') at time zone public.clinic_timezone(),
    ((current_date + 1)::timestamp + time '11:15') at time zone public.clinic_timezone(),
    'pending',
    'Annual flu vaccination.'
  ),
  (
    'eeeeeee1-0000-4000-8000-000000000004',
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaa1-0000-4000-8000-000000000004',
    ((current_date + 2)::timestamp + time '14:00') at time zone public.clinic_timezone(),
    ((current_date + 2)::timestamp + time '14:15') at time zone public.clinic_timezone(),
    'confirmed',
    null
  ),
  (
    'eeeeeee1-0000-4000-8000-000000000005',
    '55555555-5555-4555-8555-555555555555',
    '33333333-3333-4333-8333-333333333333',
    'aaaaaaa1-0000-4000-8000-000000000005',
    ((current_date + 3)::timestamp + time '13:00') at time zone public.clinic_timezone(),
    ((current_date + 3)::timestamp + time '14:00') at time zone public.clinic_timezone(),
    'pending',
    'Small laceration on left hand.'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo invoices
-- ---------------------------------------------------------------------------
insert into public.invoices (id, appointment_id, customer_id, subtotal, tax, status)
values
  (
    'fffffff1-0000-4000-8000-000000000001',
    'eeeeeee1-0000-4000-8000-000000000001',
    '44444444-4444-4444-8444-444444444444',
    65.00, 3.25, 'paid'
  ),
  (
    'fffffff1-0000-4000-8000-000000000002',
    null,
    '55555555-5555-4555-8555-555555555555',
    75.00, 0.00, 'unpaid'
  )
on conflict (id) do nothing;

insert into public.invoice_items (id, invoice_id, description, quantity, unit_price)
values
  (
    '99999991-0000-4000-8000-000000000001',
    'fffffff1-0000-4000-8000-000000000001',
    'Follow-up consultation', 1, 45.00
  ),
  (
    '99999991-0000-4000-8000-000000000002',
    'fffffff1-0000-4000-8000-000000000001',
    'Wound dressing', 1, 20.00
  ),
  (
    '99999991-0000-4000-8000-000000000003',
    'fffffff1-0000-4000-8000-000000000002',
    'General consultation (walk-in)', 1, 75.00
  )
on conflict (id) do nothing;

commit;
