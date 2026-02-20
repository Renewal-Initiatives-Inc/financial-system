-- Fix inconsistent sub_type for contra-revenue accounts 4010, 4020, 4030
-- These were seeded as 'Contra' but should be 'Contra-Revenue' to match 4040 and the Contra-{Type} convention
UPDATE accounts SET sub_type = 'Contra-Revenue' WHERE code IN ('4010', '4020', '4030') AND sub_type = 'Contra';
