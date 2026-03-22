-- Migration 0026: Rename NET_ASSET accounts to use "Retained Earnings" terminology
-- Matches owner's preferred language for year-end close reporting.
UPDATE accounts SET name = 'Retained Earnings, Without Donor Restrictions'
  WHERE code = '3000';
UPDATE accounts SET name = 'Retained Earnings, With Donor Restrictions'
  WHERE code = '3100';
