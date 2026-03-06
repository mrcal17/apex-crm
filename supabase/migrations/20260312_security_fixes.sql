-- ============================================================
-- SECURITY FIXES
-- ============================================================

-- 1. Restrict profile self-updates: users can only change full_name on their own profile
--    Admin/superadmin can change anything
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      auth_user_id = auth.uid() OR is_admin()
    )
  ) WITH CHECK (
    auth.uid() IS NOT NULL AND (
      CASE
        -- Admins can update anything
        WHEN is_admin() THEN true
        -- Self-update: only allowed if role, approval_status, commission_rate, org_id unchanged
        WHEN auth_user_id = auth.uid() THEN
          role = (SELECT p.role FROM profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
          AND approval_status = (SELECT p.approval_status FROM profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
          AND commission_rate IS NOT DISTINCT FROM (SELECT p.commission_rate FROM profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
          AND organization_id IS NOT DISTINCT FROM (SELECT p.organization_id FROM profiles p WHERE p.auth_user_id = auth.uid() LIMIT 1)
        ELSE false
      END
    )
  );

-- 2. Prevent sales_rep from directly completing projects
--    Only admin/manager/superadmin can set status to 'completed'
--    Also prevent sales_rep from inserting commissions directly
DROP POLICY IF EXISTS "commissions_insert" ON commissions;
CREATE POLICY "commissions_insert" ON commissions
  FOR INSERT WITH CHECK (
    is_admin_or_manager() AND EXISTS (
      SELECT 1 FROM projects p WHERE p.id = commissions.project_id AND p.organization_id = get_my_org_id()
    )
  );

-- 3. Add trigger to prevent sales_rep from setting project status to 'completed'
CREATE OR REPLACE FUNCTION check_completion_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Only check when status is being changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT role INTO v_role FROM profiles
    WHERE auth_user_id = auth.uid() AND approval_status = 'approved'
    LIMIT 1;

    IF v_role = 'sales_rep' THEN
      RAISE EXCEPTION 'Sales reps cannot directly complete projects. Use the completion request flow.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_completion_role_trigger ON projects;
CREATE TRIGGER check_completion_role_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION check_completion_role();

-- 4. Fix auth callback open redirect: validated in application code (no SQL needed)
