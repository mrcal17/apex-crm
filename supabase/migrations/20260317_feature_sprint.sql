-- Feature Sprint Migration: Documents, Proposals, Templates, Workflows, Portal, Reports
-- Run via Supabase Management API

-- ============================================
-- 1. DOCUMENTS (file attachments per project)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT DEFAULT '',
  category TEXT DEFAULT 'general', -- 'contract', 'proposal', 'photo', 'permit', 'invoice', 'general'
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents (project_id, created_at DESC);

-- ============================================
-- 2. PROPOSALS / QUOTES
-- ============================================
CREATE TABLE IF NOT EXISTS proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Proposal',
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'viewed', 'accepted', 'rejected'
  subtotal NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  valid_until DATE,
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS proposal_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  sort_order INT DEFAULT 0
);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to proposals" ON proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to proposal_line_items" ON proposal_line_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_proposals_project ON proposals (project_id, created_at DESC);

-- ============================================
-- 3. PROJECT TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  default_status TEXT DEFAULT 'lead',
  default_value NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'residential', -- 'residential', 'commercial', 'battery', 'custom'
  tasks JSONB DEFAULT '[]'::jsonb,     -- [{name, description, due_offset_days}]
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_templates" ON project_templates FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 4. WORKFLOW RULES (automation)
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'status_change', 'permit_expiring', 'task_overdue', 'project_created'
  trigger_config JSONB DEFAULT '{}'::jsonb, -- {from_status, to_status, days_before, etc.}
  actions JSONB DEFAULT '[]'::jsonb,         -- [{type: 'create_task', config: {...}}, {type: 'notify', config: {...}}]
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to workflow_rules" ON workflow_rules FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. CUSTOMER PORTAL TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS portal_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to portal_tokens" ON portal_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON portal_tokens (token);

-- ============================================
-- 6. SCHEDULED FOLLOW-UPS
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_followups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  channel TEXT DEFAULT 'email', -- 'email', 'sms', 'call'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE scheduled_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to scheduled_followups" ON scheduled_followups FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_followups_due ON scheduled_followups (due_at, completed);

-- ============================================
-- 7. SAVED REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'pipeline', 'revenue', 'commissions', 'permits', 'team', 'custom'
  config JSONB DEFAULT '{}'::jsonb, -- {dimensions, metrics, filters, groupBy, dateRange}
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to saved_reports" ON saved_reports FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 8. Add stage_probability to projects for weighted forecasting
-- ============================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage_probability NUMERIC DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_close_date DATE DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS close_reason TEXT DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS close_notes TEXT DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;

-- ============================================
-- 9. Add lead scoring fields
-- ============================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
