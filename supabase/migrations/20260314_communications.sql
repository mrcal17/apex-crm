-- Communications table for email/SMS tracking
CREATE TABLE IF NOT EXISTS communications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  body TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'failed', 'received')),
  metadata JSONB DEFAULT '{}',
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Message templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  subject TEXT,
  body TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-fill org_id on communications insert
CREATE OR REPLACE FUNCTION set_communication_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_communication_org
  BEFORE INSERT ON communications
  FOR EACH ROW EXECUTE FUNCTION set_communication_org_id();

-- Auto-fill org_id on message_templates insert
CREATE OR REPLACE FUNCTION set_template_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM profiles WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_template_org
  BEFORE INSERT ON message_templates
  FOR EACH ROW EXECUTE FUNCTION set_template_org_id();

-- RLS for communications
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY comms_select ON communications FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY comms_insert ON communications FOR INSERT
  WITH CHECK (organization_id IS NULL OR organization_id = (SELECT organization_id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY comms_delete ON communications FOR DELETE
  USING (
    (SELECT role FROM profiles WHERE auth_user_id = auth.uid()) IN ('admin', 'manager', 'superadmin')
  );

-- RLS for message_templates
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY templates_select ON message_templates FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY templates_insert ON message_templates FOR INSERT
  WITH CHECK (organization_id IS NULL OR organization_id = (SELECT organization_id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY templates_update ON message_templates FOR UPDATE
  USING (organization_id = (SELECT organization_id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY templates_delete ON message_templates FOR DELETE
  USING (
    created_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    OR (SELECT role FROM profiles WHERE auth_user_id = auth.uid()) IN ('admin', 'manager', 'superadmin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comms_project ON communications(project_id);
CREATE INDEX IF NOT EXISTS idx_comms_contact ON communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_comms_org ON communications(organization_id);
CREATE INDEX IF NOT EXISTS idx_comms_sent_at ON communications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_org ON message_templates(organization_id);
