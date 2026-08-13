-- Monthly per-item, per-customer sales aggregated from the Azure KAYCO_PLANNING
-- warehouse (synced by the kayco-pallet-sales-sync GitHub Actions workflow,
-- which lives in the costco-tracker-kayco repo because the Azure firewall/
-- credentials are only available there). Powers the period selector
-- (rolling 12 / YTD / custom months) in the program item picker.
CREATE TABLE IF NOT EXISTS sales_monthly (
  item_key TEXT NOT NULL,      -- unpadded Kayco item number
  customer_key TEXT NOT NULL,  -- unpadded customer/account id
  customer_name TEXT NOT NULL,
  month TEXT NOT NULL,         -- YYYY-MM
  cases REAL NOT NULL,
  net_cents INTEGER NOT NULL,
  PRIMARY KEY (item_key, customer_key, month)
);
CREATE INDEX IF NOT EXISTS idx_sales_monthly_month ON sales_monthly(month);

-- Sync bookkeeping (e.g. key 'sales_monthly:last_sync' -> ISO timestamp).
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
