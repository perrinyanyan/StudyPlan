-- Add calendar_token to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_token TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_calendar_token ON users(calendar_token);
