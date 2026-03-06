-- ============================================================
-- AUTH & RBAC MIGRATION
-- ============================================================

-- 1. Schema changes to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add manager to valid roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profile_role;
ALTER TABLE profiles ADD CONSTRAINT chk_profile_role CHECK (role IN ('admin','manager','sales_rep'));

-- 2. Schema changes to leads & client_contacts
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES profiles(id);
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS sales_rep_id UUID REFERENCES profiles(id);

-- 3. Helper functions
CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM profiles WHERE auth_user_id = auth.uid() AND approval_status = 'approved' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE auth_user_id = auth.uid() AND approval_status = 'approved' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = auth.uid()
      AND role IN ('admin','manager')
      AND approval_status = 'approved'
  );
$$;

-- 4. Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, email, full_name, role, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'sales_rep',
    'pending'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 5. RLS POLICY REWRITE
-- ============================================================

-- ---- PROFILES ----
DROP POLICY IF EXISTS "Allow all access to profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- Everyone authenticated can read profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only trigger/admin can insert (trigger handles signup)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      auth_user_id = auth.uid() OR is_admin()
    )
  );

-- Admin can update anyone, users can update own profile
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      auth_user_id = auth.uid() OR is_admin()
    )
  );

-- Only admin can delete
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (is_admin());

-- ---- PROJECTS ----
DROP POLICY IF EXISTS "Allow all access to projects" ON projects;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id()
    )
  );

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id()
    )
  );

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (is_admin());

-- ---- PERMITS ----
DROP POLICY IF EXISTS "Allow all access to permits" ON permits;
DROP POLICY IF EXISTS "permits_select" ON permits;
DROP POLICY IF EXISTS "permits_insert" ON permits;
DROP POLICY IF EXISTS "permits_update" ON permits;
DROP POLICY IF EXISTS "permits_delete" ON permits;

CREATE POLICY "permits_select" ON permits
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "permits_insert" ON permits
  FOR INSERT WITH CHECK (is_admin_or_manager());

CREATE POLICY "permits_update" ON permits
  FOR UPDATE USING (is_admin_or_manager());

CREATE POLICY "permits_delete" ON permits
  FOR DELETE USING (is_admin());

-- ---- COMMISSIONS ----
DROP POLICY IF EXISTS "Allow all access to commissions" ON commissions;
DROP POLICY IF EXISTS "commissions_select" ON commissions;
DROP POLICY IF EXISTS "commissions_insert" ON commissions;
DROP POLICY IF EXISTS "commissions_update" ON commissions;
DROP POLICY IF EXISTS "commissions_delete" ON commissions;

CREATE POLICY "commissions_select" ON commissions
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id()
    )
  );

CREATE POLICY "commissions_insert" ON commissions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "commissions_update" ON commissions
  FOR UPDATE USING (is_admin_or_manager());

CREATE POLICY "commissions_delete" ON commissions
  FOR DELETE USING (is_admin());

-- ---- BLUEPRINTS ----
DROP POLICY IF EXISTS "Allow all access to blueprints" ON blueprints;
DROP POLICY IF EXISTS "blueprints_select" ON blueprints;
DROP POLICY IF EXISTS "blueprints_insert" ON blueprints;
DROP POLICY IF EXISTS "blueprints_update" ON blueprints;
DROP POLICY IF EXISTS "blueprints_delete" ON blueprints;

CREATE POLICY "blueprints_select" ON blueprints
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "blueprints_insert" ON blueprints
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "blueprints_update" ON blueprints
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "blueprints_delete" ON blueprints
  FOR DELETE USING (is_admin_or_manager());

-- ---- SETTINGS ----
DROP POLICY IF EXISTS "Allow all access to settings" ON settings;
DROP POLICY IF EXISTS "settings_select" ON settings;
DROP POLICY IF EXISTS "settings_insert" ON settings;
DROP POLICY IF EXISTS "settings_update" ON settings;
DROP POLICY IF EXISTS "settings_delete" ON settings;

CREATE POLICY "settings_select" ON settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "settings_insert" ON settings
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "settings_update" ON settings
  FOR UPDATE USING (is_admin());

CREATE POLICY "settings_delete" ON settings
  FOR DELETE USING (is_admin());

-- ---- LEADS ----
DROP POLICY IF EXISTS "Allow all access to leads" ON leads;
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;

CREATE POLICY "leads_select" ON leads
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id() OR sales_rep_id IS NULL
    )
  );

CREATE POLICY "leads_insert" ON leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leads_update" ON leads
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id() OR sales_rep_id IS NULL
    )
  );

CREATE POLICY "leads_delete" ON leads
  FOR DELETE USING (is_admin_or_manager());

-- ---- CLIENT_CONTACTS ----
DROP POLICY IF EXISTS "Allow all access to client_contacts" ON client_contacts;
DROP POLICY IF EXISTS "client_contacts_select" ON client_contacts;
DROP POLICY IF EXISTS "client_contacts_insert" ON client_contacts;
DROP POLICY IF EXISTS "client_contacts_update" ON client_contacts;
DROP POLICY IF EXISTS "client_contacts_delete" ON client_contacts;

CREATE POLICY "client_contacts_select" ON client_contacts
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id() OR sales_rep_id IS NULL
    )
  );

CREATE POLICY "client_contacts_insert" ON client_contacts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_contacts_update" ON client_contacts
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id() OR sales_rep_id IS NULL
    )
  );

CREATE POLICY "client_contacts_delete" ON client_contacts
  FOR DELETE USING (is_admin_or_manager());

-- ---- ACTIVITY_LOG (if exists) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_log' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all access to activity_log" ON activity_log';
    EXECUTE 'CREATE POLICY "activity_log_select" ON activity_log FOR SELECT USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END
$$;

-- ---- PROJECT_NOTES (if exists) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_notes' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all access to project_notes" ON project_notes';
    EXECUTE 'CREATE POLICY "project_notes_select" ON project_notes FOR SELECT USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "project_notes_insert" ON project_notes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "project_notes_update" ON project_notes FOR UPDATE USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "project_notes_delete" ON project_notes FOR DELETE USING (is_admin_or_manager())';
  END IF;
END
$$;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_projects_sales_rep_id ON projects(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_leads_sales_rep_id ON leads(sales_rep_id);
