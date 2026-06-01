-- QuestDB table definitions for Mach-Zero trading system
-- Apply via: curl -G http://localhost:9000/exec --data-urlencode "query=<SQL>"

-- Trades table: all market trades from gateways
CREATE TABLE IF NOT EXISTS trades (
    tenant_id STRING,
    symbol_id LONG,
    venue INT,
    price DOUBLE,
    quantity DOUBLE,
    side INT,
    strategy_id STRING,
    trading_mode SYMBOL,
    timestamp TIMESTAMP
) TIMESTAMP(timestamp) PARTITION BY DAY WAL;

-- Orders table: all order lifecycle events
CREATE TABLE IF NOT EXISTS orders (
    tenant_id STRING,
    symbol_id LONG,
    order_id LONG,
    side INT,
    price DOUBLE,
    quantity DOUBLE,
    status SYMBOL,
    strategy_id STRING,
    trading_mode SYMBOL,
    timestamp TIMESTAMP
) TIMESTAMP(timestamp) PARTITION BY DAY WAL;

-- Risk events: rejections and kill switch activations
CREATE TABLE IF NOT EXISTS risk_events (
    tenant_id STRING,
    symbol_id LONG,
    order_id LONG,
    reason SYMBOL,
    strategy_id STRING,
    trading_mode SYMBOL,
    timestamp TIMESTAMP
) TIMESTAMP(timestamp) PARTITION BY DAY WAL;

-- Migration for existing tables (run manually if tables already exist):
-- QuestDB does not support ALTER TABLE ADD COLUMN on WAL tables.
-- 1. RENAME TABLE trades TO trades_backup;
-- 2. CREATE TABLE trades (...new schema above...);
-- 3. INSERT INTO trades SELECT 'default', symbol_id, venue, price, quantity, side, strategy_id, trading_mode, timestamp FROM trades_backup;
-- 4. DROP TABLE trades_backup;
-- Repeat for orders and risk_events.

-- Post-v3 (SBE tenantId) migration for legacy rows:
-- Pre-migration rows written by the persistence service have tenant_id NULL
-- or empty, because the prior code never populated the column. Backfill them
-- with the reserved sentinel '0' so web read-path filters (WHERE tenant_id
-- = $engineId) naturally hide legacy data from per-tenant UI queries. A
-- super-admin tool or separate /api/admin/market-data can expose them.
-- Run once, post-deploy:
-- UPDATE trades       SET tenant_id = '0' WHERE tenant_id IS NULL OR tenant_id = '';
-- UPDATE orders       SET tenant_id = '0' WHERE tenant_id IS NULL OR tenant_id = '';
-- UPDATE risk_events  SET tenant_id = '0' WHERE tenant_id IS NULL OR tenant_id = '';
