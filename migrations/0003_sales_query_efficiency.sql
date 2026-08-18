-- Fix for the D1 free-tier row-read blowout (2026-08-18): summary queries
-- scanned every row in the month range (~2M rows per query) because customer
-- filtering wasn't indexable. Adds:
--  1. customers_dim - small (customer_key -> name) table so name-prefix
--     patterns resolve to keys without touching the fact table.
--  2. An index so per-customer month-range reads touch only relevant rows.
CREATE TABLE IF NOT EXISTS customers_dim (
  customer_key TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT OR REPLACE INTO customers_dim (customer_key, name)
  SELECT customer_key, MAX(customer_name) FROM sales_monthly GROUP BY customer_key;
CREATE INDEX IF NOT EXISTS idx_sales_monthly_customer_month
  ON sales_monthly(customer_key, month);
