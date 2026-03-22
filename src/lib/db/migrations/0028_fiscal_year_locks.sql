-- Migration 0028: Create fiscal_year_locks table
-- Tracks which fiscal years are locked or reopened, with full audit trail.
CREATE TABLE fiscal_year_locks (
  id serial PRIMARY KEY,
  fiscal_year integer NOT NULL UNIQUE,
  status varchar(20) NOT NULL,
  locked_at timestamp NOT NULL DEFAULT now(),
  locked_by varchar(255) NOT NULL,
  reopened_at timestamp,
  reopened_by varchar(255),
  reopen_reason text,
  created_at timestamp NOT NULL DEFAULT now()
);
