-- Phase 23a Task 2: Matching rules enhancements
-- Add settlementDayOffset and autoMatchEligible to matching_rules,
-- plus app_settings table for global tier thresholds.

ALTER TABLE matching_rules
  ADD COLUMN settlement_day_offset INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN auto_match_eligible BOOLEAN NOT NULL DEFAULT false;

-- App-wide settings (key-value store for configurable thresholds)
CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value VARCHAR(500) NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default auto-match threshold settings
INSERT INTO app_settings (key, value, description) VALUES
  ('autoMatchMinHitCount', '5', 'Minimum rule hit count for auto-match eligibility'),
  ('autoMatchMinConfidence', '0.95', 'Minimum confidence score for Tier 1 auto-match'),
  ('autoMatchMaxAmount', '500.00', 'Maximum transaction amount for auto-match'),
  ('reviewMinConfidence', '0.70', 'Minimum confidence for Tier 2 batch review');
