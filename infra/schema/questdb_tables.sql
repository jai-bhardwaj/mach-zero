-- QuestDB table definitions for Mach-Zero trading system
-- Apply via: curl -G http://localhost:9000/exec --data-urlencode "query=<SQL>"

-- Trades table: all market trades from gateways
CREATE TABLE IF NOT EXISTS trades (
    symbol_id LONG,
    venue INT,
    price DOUBLE,
    quantity DOUBLE,
    side INT,
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
    timestamp TIMESTAMP
) TIMESTAMP(timestamp) PARTITION BY DAY WAL;

-- Risk events: rejections and kill switch activations
CREATE TABLE IF NOT EXISTS risk_events (
    symbol_id LONG,
    order_id LONG,
    reason SYMBOL,
    timestamp TIMESTAMP
) TIMESTAMP(timestamp) PARTITION BY DAY WAL;
