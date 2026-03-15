-- QuestDB table definitions for Mach-Zero trading system
-- Apply via: curl -G http://localhost:9000/exec --data-urlencode "query=<SQL>"

-- Trades table: all market trades from gateways
CREATE TABLE IF NOT EXISTS trades (
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
-- 3. INSERT INTO trades SELECT symbol_id, venue, price, quantity, side, '', 'MOCK', timestamp FROM trades_backup;
-- 4. DROP TABLE trades_backup;
-- Repeat for orders and risk_events.
