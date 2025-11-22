-- Migration: Add plan visibility control
-- Purpose: Allow System Admins to control which schools see global plans
--          Allow School Admins to control which classes see school plans

CREATE TABLE IF NOT EXISTS plan_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  optional_plan_id uuid NOT NULL REFERENCES optional_plans(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('school', 'class')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  UNIQUE(optional_plan_id, target_type, target_id)
);

-- Indexes for performance
CREATE INDEX idx_plan_visibility_plan ON plan_visibility(optional_plan_id);
CREATE INDEX idx_plan_visibility_target ON plan_visibility(target_type, target_id);

-- Comments for documentation
COMMENT ON TABLE plan_visibility IS 'Controls which schools/classes can see specific optional plans';
COMMENT ON COLUMN plan_visibility.target_type IS 'Either school or class';
COMMENT ON COLUMN plan_visibility.target_id IS 'ID of school or class that can see this plan';
