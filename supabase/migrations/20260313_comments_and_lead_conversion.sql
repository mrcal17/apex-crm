-- Project comments table (threaded discussion on projects)
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-fill org_id on comment insert
CREATE OR REPLACE FUNCTION set_comment_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM profiles WHERE id = NEW.author_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_comment_org
  BEFORE INSERT ON project_comments
  FOR EACH ROW EXECUTE FUNCTION set_comment_org_id();

-- RLS for project_comments
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select ON project_comments FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY comments_insert ON project_comments FOR INSERT
  WITH CHECK (organization_id IS NULL OR organization_id = (SELECT organization_id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY comments_delete ON project_comments FOR DELETE
  USING (
    author_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM profiles WHERE auth_user_id = auth.uid()) IN ('admin', 'manager', 'superadmin')
  );

-- Add lead conversion tracking columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
