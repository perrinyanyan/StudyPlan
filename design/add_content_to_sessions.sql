-- Add content column to course_sessions
ALTER TABLE course_sessions 
ADD COLUMN IF NOT EXISTS content TEXT;

-- Add content column to tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS content TEXT;
