INSERT INTO asset_types (type_name) VALUES
('Stock'),
('Crypto');

INSERT INTO assets (asset_type_id, symbol, asset_name, market) VALUES
(1, 'AAPL', 'Apple Inc.', 'NASDAQ'),
(2, 'BTCUSD', 'Bitcoin / US Dollar', 'CRYPTO');

INSERT INTO strategies (strategy_name, strategy_key, description) VALUES
('Moving Average Crossover', 'moving_average_crossover', 'Buy when short MA crosses above long MA.'),
('RSI Reversal', 'rsi_reversal', 'Buy in oversold conditions and sell in overbought conditions.');
