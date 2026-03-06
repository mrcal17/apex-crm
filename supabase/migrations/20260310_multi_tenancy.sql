-- ============================================================
-- MULTI-TENANCY + SOLAR CACHE MIGRATION
-- ============================================================

-- ============================================================
-- 1a. NEW TABLES
-- ============================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Solar cache table (cross-org, no org_id)
CREATE TABLE IF NOT EXISTS solar_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address_key TEXT UNIQUE NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  solar_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE solar_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1f. Join code generator
-- ============================================================
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-char alphanumeric code with dash: XXXX-XXXX
    code := upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
    SELECT EXISTS(SELECT 1 FROM organizations WHERE join_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- ============================================================
-- 1b. ADD organization_id TO EXISTING TABLES
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ============================================================
-- 1c. CONSTRAINTS & INDEXES
-- ============================================================

-- Settings: drop old unique on key, add composite unique
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settings_organization_id_key_key'
  ) THEN
    ALTER TABLE settings ADD CONSTRAINT settings_organization_id_key_key UNIQUE (organization_id, key);
  END IF;
END $$;

-- Indexes on organization_id
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_settings_organization_id ON settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id ON activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_organization_id ON client_contacts(organization_id);

-- ============================================================
-- 1d. NEW DB FUNCTIONS
-- ============================================================

-- Get current user's org_id
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM profiles
  WHERE auth_user_id = auth.uid() AND approval_status = 'approved'
  LIMIT 1;
$$;

-- Auto-fill organization_id on INSERT when NULL
CREATE OR REPLACE FUNCTION set_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_my_org_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to tables that need auto-fill
DROP TRIGGER IF EXISTS set_org_id_projects ON projects;
CREATE TRIGGER set_org_id_projects
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

DROP TRIGGER IF EXISTS set_org_id_leads ON leads;
CREATE TRIGGER set_org_id_leads
  BEFORE INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

DROP TRIGGER IF EXISTS set_org_id_settings ON settings;
CREATE TRIGGER set_org_id_settings
  BEFORE INSERT ON settings
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

DROP TRIGGER IF EXISTS set_org_id_activity_log ON activity_log;
CREATE TRIGGER set_org_id_activity_log
  BEFORE INSERT ON activity_log
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

DROP TRIGGER IF EXISTS set_org_id_client_contacts ON client_contacts;
CREATE TRIGGER set_org_id_client_contacts
  BEFORE INSERT ON client_contacts
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

-- ============================================================
-- 1e. REWRITE ALL RLS POLICIES
-- ============================================================

-- ---- ORGANIZATIONS ----
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "org_update" ON organizations
  FOR UPDATE USING (id = get_my_org_id());

-- ---- PROFILES ----
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- Own profile OR same-org profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      auth_user_id = auth.uid() OR organization_id = get_my_org_id()
    )
  );

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      auth_user_id = auth.uid() OR is_admin()
    )
  );

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      auth_user_id = auth.uid() OR is_admin()
    )
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND (
      auth_user_id = auth.uid() OR is_admin()
    )
  );

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE USING (is_admin());

-- ---- PROJECTS ----
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND organization_id = get_my_org_id() AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id()
    )
  );

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND organization_id = get_my_org_id() AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id()
    )
  );

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (organization_id = get_my_org_id() AND is_admin());

-- ---- PERMITS (FK-inherited via project_id) ----
DROP POLICY IF EXISTS "permits_select" ON permits;
DROP POLICY IF EXISTS "permits_insert" ON permits;
DROP POLICY IF EXISTS "permits_update" ON permits;
DROP POLICY IF EXISTS "permits_delete" ON permits;

CREATE POLICY "permits_select" ON permits
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = permits.project_id AND p.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "permits_insert" ON permits
  FOR INSERT WITH CHECK (
    is_admin_or_manager() AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = permits.project_id AND p.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "permits_update" ON permits
  FOR UPDATE USING (
    is_admin_or_manager() AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = permits.project_id AND p.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "permits_delete" ON permits
  FOR DELETE USING (
    is_admin() AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = permits.project_id AND p.organization_id = get_my_org_id()
    )
  );

-- ---- COMMISSIONS (FK-inherited via project_id) ----
DROP POLICY IF EXISTS "commissions_select" ON commissions;
DROP POLICY IF EXISTS "commissions_insert" ON commissions;
DROP POLICY IF EXISTS "commissions_update" ON commissions;
DROP POLICY IF EXISTS "commissions_delete" ON commissions;

CREATE POLICY "commissions_select" ON commissions
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = commissions.project_id AND p.organization_id = get_my_org_id()
    ) AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id()
    )
  );

CREATE POLICY "commissions_insert" ON commissions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = commissions.project_id AND p.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "commissions_update" ON commissions
  FOR UPDATE USING (
    is_admin_or_manager() AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = commissions.project_id AND p.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "commissions_delete" ON commissions
  FOR DELETE USING (
    is_admin() AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = commissions.project_id AND p.organization_id = get_my_org_id()
    )
  );

-- ---- BLUEPRINTS (FK-inherited via project_id) ----
DROP POLICY IF EXISTS "blueprints_select" ON blueprints;
DROP POLICY IF EXISTS "blueprints_insert" ON blueprints;
DROP POLICY IF EXISTS "blueprints_update" ON blueprints;
DROP POLICY IF EXISTS "blueprints_delete" ON blueprints;

CREATE POLICY "blueprints_select" ON blueprints
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = blueprints.project_id AND p.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "blueprints_insert" ON blueprints
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = blueprints.project_id AND p.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "blueprints_update" ON blueprints
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = blueprints.project_id AND p.organization_id = get_my_org_id()
    )
  );

CREATE POLICY "blueprints_delete" ON blueprints
  FOR DELETE USING (
    is_admin_or_manager() AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = blueprints.project_id AND p.organization_id = get_my_org_id()
    )
  );

-- ---- SETTINGS ----
DROP POLICY IF EXISTS "settings_select" ON settings;
DROP POLICY IF EXISTS "settings_insert" ON settings;
DROP POLICY IF EXISTS "settings_update" ON settings;
DROP POLICY IF EXISTS "settings_delete" ON settings;

CREATE POLICY "settings_select" ON settings
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND organization_id = get_my_org_id()
  );

CREATE POLICY "settings_insert" ON settings
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "settings_update" ON settings
  FOR UPDATE USING (organization_id = get_my_org_id() AND is_admin());

CREATE POLICY "settings_delete" ON settings
  FOR DELETE USING (organization_id = get_my_org_id() AND is_admin());

-- ---- LEADS ----
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;

CREATE POLICY "leads_select" ON leads
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND organization_id = get_my_org_id() AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id() OR sales_rep_id IS NULL
    )
  );

CREATE POLICY "leads_insert" ON leads
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leads_update" ON leads
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND organization_id = get_my_org_id() AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id() OR sales_rep_id IS NULL
    )
  );

CREATE POLICY "leads_delete" ON leads
  FOR DELETE USING (organization_id = get_my_org_id() AND is_admin_or_manager());

-- ---- CLIENT_CONTACTS ----
DROP POLICY IF EXISTS "client_contacts_select" ON client_contacts;
DROP POLICY IF EXISTS "client_contacts_insert" ON client_contacts;
DROP POLICY IF EXISTS "client_contacts_update" ON client_contacts;
DROP POLICY IF EXISTS "client_contacts_delete" ON client_contacts;

CREATE POLICY "client_contacts_select" ON client_contacts
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND organization_id = get_my_org_id() AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id() OR sales_rep_id IS NULL
    )
  );

CREATE POLICY "client_contacts_insert" ON client_contacts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_contacts_update" ON client_contacts
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND organization_id = get_my_org_id() AND (
      is_admin_or_manager() OR sales_rep_id = get_my_profile_id() OR sales_rep_id IS NULL
    )
  );

CREATE POLICY "client_contacts_delete" ON client_contacts
  FOR DELETE USING (organization_id = get_my_org_id() AND is_admin_or_manager());

-- ---- ACTIVITY_LOG ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_log' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "activity_log_select" ON activity_log';
    EXECUTE 'DROP POLICY IF EXISTS "activity_log_insert" ON activity_log';
    EXECUTE 'CREATE POLICY "activity_log_select" ON activity_log FOR SELECT USING (auth.uid() IS NOT NULL AND organization_id = get_my_org_id())';
    EXECUTE 'CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- ---- PROJECT_NOTES (FK-inherited via project_id) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_notes' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "project_notes_select" ON project_notes';
    EXECUTE 'DROP POLICY IF EXISTS "project_notes_insert" ON project_notes';
    EXECUTE 'DROP POLICY IF EXISTS "project_notes_update" ON project_notes';
    EXECUTE 'DROP POLICY IF EXISTS "project_notes_delete" ON project_notes';
    EXECUTE 'CREATE POLICY "project_notes_select" ON project_notes FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_notes.project_id AND p.organization_id = get_my_org_id()))';
    EXECUTE 'CREATE POLICY "project_notes_insert" ON project_notes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_notes.project_id AND p.organization_id = get_my_org_id()))';
    EXECUTE 'CREATE POLICY "project_notes_update" ON project_notes FOR UPDATE USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_notes.project_id AND p.organization_id = get_my_org_id()))';
    EXECUTE 'CREATE POLICY "project_notes_delete" ON project_notes FOR DELETE USING (is_admin_or_manager() AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_notes.project_id AND p.organization_id = get_my_org_id()))';
  END IF;
END $$;

-- ============================================================
-- 1g. UPDATE handle_new_user() TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_join_code TEXT;
  v_org_name TEXT;
  v_org_id UUID;
  v_role TEXT;
  v_status TEXT;
  v_slug TEXT;
BEGIN
  v_join_code := NEW.raw_user_meta_data->>'join_code';
  v_org_name := NEW.raw_user_meta_data->>'org_name';

  IF v_join_code IS NOT NULL AND v_join_code != '' THEN
    -- Join existing org
    SELECT id INTO v_org_id FROM organizations WHERE join_code = v_join_code;
    IF v_org_id IS NULL THEN
      -- Invalid join code: create profile without org
      INSERT INTO public.profiles (auth_user_id, email, full_name, role, approval_status)
      VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'sales_rep', 'pending');
      RETURN NEW;
    END IF;
    v_role := 'sales_rep';
    v_status := 'pending';
  ELSIF v_org_name IS NOT NULL AND v_org_name != '' THEN
    -- Create new org
    v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
    INSERT INTO organizations (name, slug, join_code)
    VALUES (v_org_name, v_slug, generate_join_code())
    RETURNING id INTO v_org_id;
    v_role := 'admin';
    v_status := 'approved';
  ELSE
    -- Legacy signup (no org context) — pending with no org
    INSERT INTO public.profiles (auth_user_id, email, full_name, role, approval_status)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'sales_rep', 'pending');
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (auth_user_id, email, full_name, role, approval_status, organization_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), v_role, v_status, v_org_id);

  -- Set created_by on org if we just created it
  IF v_org_name IS NOT NULL AND v_org_name != '' AND v_org_id IS NOT NULL THEN
    UPDATE organizations SET created_by = (
      SELECT id FROM profiles WHERE auth_user_id = NEW.id LIMIT 1
    ) WHERE id = v_org_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 1h. UPDATE ACTIVITY LOG TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (entity_type, entity_id, action, details, organization_id)
    VALUES ('project', NEW.id, 'created', 'Created project "' || NEW.name || '"', NEW.organization_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO activity_log (entity_type, entity_id, action, details, organization_id)
      VALUES ('project', NEW.id, 'status_changed', '"' || NEW.name || '" changed from ' || OLD.status || ' to ' || NEW.status, NEW.organization_id);
    ELSE
      INSERT INTO activity_log (entity_type, entity_id, action, details, organization_id)
      VALUES ('project', NEW.id, 'updated', 'Updated project "' || NEW.name || '"', NEW.organization_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (entity_type, entity_id, action, details, organization_id)
    VALUES ('project', OLD.id, 'deleted', 'Deleted project "' || OLD.name || '"', OLD.organization_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_commission_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM projects WHERE id = NEW.project_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (entity_type, entity_id, action, details, organization_id)
    VALUES ('commission', NEW.id, 'created', 'Commission of $' || NEW.amount || ' created', v_org_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO activity_log (entity_type, entity_id, action, details, organization_id)
      VALUES ('commission', NEW.id, 'status_changed', 'Commission status changed to ' || NEW.status, v_org_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_permit_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM projects WHERE id = NEW.project_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (entity_type, entity_id, action, details, organization_id)
    VALUES ('permit', NEW.id, 'created', 'Permit "' || coalesce(NEW.permit_number, NEW.agency, 'Unknown') || '" created', v_org_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO activity_log (entity_type, entity_id, action, details, organization_id)
      VALUES ('permit', NEW.id, 'status_changed', 'Permit "' || coalesce(NEW.permit_number, NEW.agency, 'Unknown') || '" changed to ' || NEW.status, v_org_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1i. MIGRATE EXISTING DATA
-- ============================================================

-- Create "Default Organization" and assign all existing data
DO $$
DECLARE
  v_default_org_id UUID;
BEGIN
  -- Create default org
  INSERT INTO organizations (name, slug, join_code)
  VALUES ('AIPAC', 'aipac', generate_join_code())
  RETURNING id INTO v_default_org_id;

  -- Update all existing rows
  UPDATE profiles SET organization_id = v_default_org_id WHERE organization_id IS NULL;
  UPDATE projects SET organization_id = v_default_org_id WHERE organization_id IS NULL;
  UPDATE leads SET organization_id = v_default_org_id WHERE organization_id IS NULL;
  UPDATE settings SET organization_id = v_default_org_id WHERE organization_id IS NULL;
  UPDATE activity_log SET organization_id = v_default_org_id WHERE organization_id IS NULL;
  UPDATE client_contacts SET organization_id = v_default_org_id WHERE organization_id IS NULL;

  -- Set created_by to first admin profile in default org
  UPDATE organizations SET created_by = (
    SELECT id FROM profiles WHERE organization_id = v_default_org_id AND role = 'admin' LIMIT 1
  ) WHERE id = v_default_org_id;
END $$;

-- Now make organization_id NOT NULL on tables that require it
ALTER TABLE profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE leads ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE activity_log ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE client_contacts ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================
-- 1j. SOLAR CACHE RLS
-- ============================================================

CREATE POLICY "solar_cache_select" ON solar_cache
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- No INSERT/UPDATE/DELETE policies for users — service role only
