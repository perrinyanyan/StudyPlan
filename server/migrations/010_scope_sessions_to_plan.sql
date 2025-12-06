-- Add optional_plan_id to course_sessions table
ALTER TABLE course_sessions 
ADD COLUMN IF NOT EXISTS optional_plan_id UUID REFERENCES optional_plans(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_course_sessions_plan_id ON course_sessions(optional_plan_id);

-- Note: We do not enforce NOT NULL initially to support existing global sessions (if any)
-- or we can treat NULL as 'Global' sessions visible to all.
-- In this specific refactor, we intend to scope all new sessions to a plan.
