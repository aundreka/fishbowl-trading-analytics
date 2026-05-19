export type Asset = {
  asset_id: number;
  symbol: string;
  asset_name: string;
  market: string;
  asset_type_id: number;
  asset_type: string;
  price_points: number;
};

export type StrategyParameter = {
  parameter_id: number;
  strategy_id: number;
  parameter_name: string;
  data_type: string;
  default_value: string;
};

export type Strategy = {
  strategy_id: number;
  strategy_name: string;
  strategy_key: string;
  description: string;
  parameters: StrategyParameter[];
};

export type BacktestMetrics = {
  metric_id?: number;
  backtest_run_id?: number;
  total_return: number;
  net_profit: number;
  win_rate: number;
  max_drawdown: number;
  sharpe_ratio: number;
  total_trades: number;
};

export type BacktestRun = {
  backtest_run_id: number;
  user_id: number;
  asset_id: number;
  strategy_id: number;
  run_name: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  trading_fee: number;
  created_at: string;
  metrics?: Partial<BacktestMetrics>;
};

export type BacktestTrade = {
  trade_id: number;
  backtest_run_id?: number;
  trade_datetime: string;
  trade_action: string;
  quantity: number;
  price: number;
  fee: number;
  cash_balance: number;
  position_balance: number;
};

export type User = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed.";
}
