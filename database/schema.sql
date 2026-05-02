CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE asset_types (
  asset_type_id SERIAL PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE assets (
  asset_id SERIAL PRIMARY KEY,
  asset_type_id INT NOT NULL REFERENCES asset_types(asset_type_id),
  symbol VARCHAR(20) NOT NULL UNIQUE,
  asset_name VARCHAR(100) NOT NULL,
  market VARCHAR(50)
);

CREATE TABLE historical_prices (
  price_id BIGSERIAL PRIMARY KEY,
  asset_id INT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  price_datetime TIMESTAMP NOT NULL,
  open_price NUMERIC(18, 6) NOT NULL,
  high_price NUMERIC(18, 6) NOT NULL,
  low_price NUMERIC(18, 6) NOT NULL,
  close_price NUMERIC(18, 6) NOT NULL,
  volume NUMERIC(18, 2),
  UNIQUE (asset_id, price_datetime)
);

CREATE TABLE strategies (
  strategy_id SERIAL PRIMARY KEY,
  strategy_name VARCHAR(100) NOT NULL UNIQUE,
  strategy_key VARCHAR(60) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE strategy_parameters (
  parameter_id SERIAL PRIMARY KEY,
  strategy_id INT NOT NULL REFERENCES strategies(strategy_id) ON DELETE CASCADE,
  parameter_name VARCHAR(100) NOT NULL,
  data_type VARCHAR(20) NOT NULL,
  default_value VARCHAR(50)
);

CREATE TABLE backtest_runs (
  backtest_run_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  asset_id INT NOT NULL REFERENCES assets(asset_id),
  strategy_id INT NOT NULL REFERENCES strategies(strategy_id),
  run_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_capital NUMERIC(18, 2) NOT NULL,
  trading_fee NUMERIC(8, 4) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE backtest_run_parameters (
  run_parameter_id SERIAL PRIMARY KEY,
  backtest_run_id INT NOT NULL REFERENCES backtest_runs(backtest_run_id) ON DELETE CASCADE,
  parameter_id INT NOT NULL REFERENCES strategy_parameters(parameter_id),
  parameter_value VARCHAR(50) NOT NULL
);

CREATE TABLE simulated_trades (
  trade_id BIGSERIAL PRIMARY KEY,
  backtest_run_id INT NOT NULL REFERENCES backtest_runs(backtest_run_id) ON DELETE CASCADE,
  trade_datetime TIMESTAMP NOT NULL,
  trade_action VARCHAR(10) NOT NULL,
  quantity NUMERIC(18, 6) NOT NULL,
  price NUMERIC(18, 6) NOT NULL,
  fee NUMERIC(18, 2) NOT NULL DEFAULT 0,
  cash_balance NUMERIC(18, 2) NOT NULL,
  position_balance NUMERIC(18, 6) NOT NULL
);

CREATE TABLE performance_metrics (
  metric_id SERIAL PRIMARY KEY,
  backtest_run_id INT NOT NULL UNIQUE REFERENCES backtest_runs(backtest_run_id) ON DELETE CASCADE,
  total_return NUMERIC(10, 4),
  net_profit NUMERIC(18, 2),
  win_rate NUMERIC(5, 2),
  max_drawdown NUMERIC(10, 4),
  sharpe_ratio NUMERIC(10, 4),
  total_trades INT
);
