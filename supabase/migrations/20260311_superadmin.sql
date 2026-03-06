-- ============================================================
-- SUPERADMIN ROLE MIGRATION
-- ============================================================

-- 1. Expand role constraint to include superadmin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profile_role;
ALTER TABLE profiles ADD CONSTRAINT chk_profile_role CHECK (role IN ('admin','manager','sales_rep','superadmin'));

-- 2. Promote landaucharlie@yahoo.com to superadmin
UPDATE profiles SET role = 'superadmin' WHERE email = 'landaucharlie@yahoo.com';

-- 3. Allow profiles.organization_id to be NULL (for signups without join code)
ALTER TABLE profiles ALTER COLUMN organization_id DROP NOT NULL;

-- 4. New function: is_superadmin()
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = auth.uid()
      AND role = 'superadmin'
      AND approval_status = 'approved'
  );
$$;

-- 5. Rewrite is_admin() to also return true for superadmin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'superadmin')
      AND approval_status = 'approved'
  );
$$;

-- 6. Rewrite is_admin_or_manager() to include superadmin
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = auth.uid()
      AND role IN ('admin', 'manager', 'superadmin')
      AND approval_status = 'approved'
  );
$$;

-- 7. Update organizations INSERT policy: only superadmin
DROP POLICY IF EXISTS "org_insert" ON organizations;
CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (is_superadmin());

-- 8. Add organizations DELETE policy: only superadmin
DROP POLICY IF EXISTS "org_delete" ON organizations;
CREATE POLICY "org_delete" ON organizations
  FOR DELETE USING (is_superadmin());

-- 9. Rewrite handle_new_user(): remove org_name branch
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_join_code TEXT;
  v_org_id UUID;
BEGIN
  v_join_code := NEW.raw_user_meta_data->>'join_code';

  IF v_join_code IS NOT NULL AND v_join_code != '' THEN
    -- Join existing org
    SELECT id INTO v_org_id FROM organizations WHERE join_code = v_join_code;
    IF v_org_id IS NULL THEN
      -- Invalid join code: create profile without org, pending
      INSERT INTO public.profiles (auth_user_id, email, full_name, role, approval_status)
      VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'sales_rep', 'pending');
      RETURN NEW;
    END IF;
    INSERT INTO public.profiles (auth_user_id, email, full_name, role, approval_status, organization_id)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'sales_rep', 'pending', v_org_id);
  ELSE
    -- No join code: create profile with no org, pending
    INSERT INTO public.profiles (auth_user_id, email, full_name, role, approval_status)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'sales_rep', 'pending');
  END IF;

  RETURN NEW;
END;
$$;
