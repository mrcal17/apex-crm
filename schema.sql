-- GOYCATTLEHERDER CRM SCHEMA - ROBUST VERSION

-- 1. CLEAN SLATE (Optional: Uncomment to wipe and restart)
-- DROP TABLE IF EXISTS blueprints, commissions, permits, projects, profiles CASCADE;

-- 2. Profiles (Sales & Project Managers)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'sales_rep', -- 'sales_rep' or 'admin'
  commission_rate NUMERIC DEFAULT 0.10, -- 10% default
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  client_name TEXT,
  contract_value NUMERIC DEFAULT 0,
  revenue_collected NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'lead', -- 'lead', 'in_progress', 'completed', 'cancelled'
  sales_rep_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Permits
CREATE TABLE IF NOT EXISTS permits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agency TEXT, -- e.g., 'City of Miami'
  permit_number TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'submitted', 'approved', 'expired'
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. Commissions
CREATE TABLE IF NOT EXISTS commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  sales_rep_id UUID REFERENCES profiles(id),
  amount NUMERIC,
  status TEXT DEFAULT 'unpaid', -- 'unpaid', 'paid'
  payout_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Blueprints (Metadata - actual files go in Supabase Storage)
CREATE TABLE IF NOT EXISTS blueprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
CREATE POLICY "Allow all access to settings" ON settings
  FOR ALL USING (true) WITH CHECK (true);

-- 8. Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  street TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  zip TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to leads" ON leads
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_leads_active ON leads (active, name);
