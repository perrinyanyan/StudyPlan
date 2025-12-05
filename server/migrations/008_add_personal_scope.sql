-- Migration: Add 'personal' to scope_type enum
-- Purpose: Allow plans to be scoped to the creator only

ALTER TYPE scope_type ADD VALUE IF NOT EXISTS 'personal';
