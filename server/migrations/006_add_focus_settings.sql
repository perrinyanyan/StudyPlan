ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS focus_duration_minutes INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS focus_start_sound TEXT DEFAULT 'gentle',
ADD COLUMN IF NOT EXISTS focus_end_sound TEXT DEFAULT 'gentle';
