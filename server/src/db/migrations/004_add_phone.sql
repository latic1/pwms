-- Migration: 004_add_phone.sql
-- Add optional phone number to users for SMS notifications

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
