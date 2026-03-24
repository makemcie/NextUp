ALTER TABLE shops ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE shops ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE shops ADD COLUMN subscription_status TEXT DEFAULT 'trial';
ALTER TABLE shops ADD COLUMN subscription_ends_at INTEGER;
