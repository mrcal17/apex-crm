-- ============================================================
-- PENDING COMPLETIONS TABLE
-- Sales reps request completion; managers/admins confirm
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE pending_completions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pending_completions_org ON pending_completions(organization_id);
CREATE INDEX IF NOT EXISTS idx_pending_completions_status ON pending_completions(status);
CREATE INDEX IF NOT EXISTS idx_pending_completions_project ON pending_completions(project_id);

-- Auto-fill organization_id
DROP TRIGGER IF EXISTS set_org_id_pending_completions ON pending_completions;
CREATE TRIGGER set_org_id_pending_completions
  BEFORE INSERT ON pending_completions
  FOR EACH ROW EXECUTE FUNCTION set_organization_id();

-- RLS: same-org users can see pending completions
CREATE POLICY "pending_completions_select" ON pending_completions
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND organization_id = get_my_org_id()
  );

-- Any authenticated user can create a request
CREATE POLICY "pending_completions_insert" ON pending_completions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins/managers can update (approve/reject)
CREATE POLICY "pending_completions_update" ON pending_completions
  FOR UPDATE USING (
    organization_id = get_my_org_id() AND is_admin_or_manager()
  );

-- Only admins can delete
CREATE POLICY "pending_completions_delete" ON pending_completions
  FOR DELETE USING (
    organization_id = get_my_org_id() AND is_admin()
  );
