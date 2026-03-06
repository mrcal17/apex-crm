-- Add interconnection and PTO tracking columns to projects table

-- Interconnection tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS interconnection_status TEXT NOT NULL DEFAULT 'not_started'
  CHECK (interconnection_status IN ('not_started', 'submitted', 'approved', 'denied'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS interconnection_submitted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS interconnection_approved_at TIMESTAMPTZ;

-- PTO (Permission to Operate) tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pto_status TEXT NOT NULL DEFAULT 'not_started'
  CHECK (pto_status IN ('not_started', 'submitted', 'granted'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pto_submitted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pto_granted_at TIMESTAMPTZ;

-- Utility information
ALTER TABLE projects ADD COLUMN IF NOT EXISTS utility_name TEXT;

-- Checklist template: JSONB array of {name, required, completed} objects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS utility_checklist JSONB DEFAULT '[]'::jsonb;

-- Indexes for filtering by status
CREATE INDEX IF NOT EXISTS idx_projects_interconnection_status ON projects(interconnection_status);
CREATE INDEX IF NOT EXISTS idx_projects_pto_status ON projects(pto_status);
