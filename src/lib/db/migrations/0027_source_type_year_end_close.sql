-- Migration 0027: Add YEAR_END_CLOSE to source_type enum
-- Closing entries must be distinguishable from MANUAL/SYSTEM entries for reporting exclusion.
ALTER TYPE source_type ADD VALUE 'YEAR_END_CLOSE';
