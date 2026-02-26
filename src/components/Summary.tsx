import React from 'react';
import { Trade, calculateTrade } from '../types';
import { TrendingUp, TrendingDown, Wallet, PieChart } from 'lucide-react';

interface SummaryProps {
  trades: Trade[];
}

export function Summary({ trades }: SummaryProps) {
  const stats = trades.reduce(
    (acc, trade) => {
      const calc = calculateTrade(trade);
      
      if (calc.isSold) {
        acc.realizedProfit += calc.profit;
        acc.totalTrades += 1;
        if (calc.profit > 0) acc.winningTrades += 1;
        acc.totalVolume += calc.sellAmount + calc.buyAmount;
        acc.totalTax += calc.tax;
        acc.totalFees += calc.buyFee + calc.sellFee;
      } else {
        acc.holdingCost += calc.totalCost;
        // For holding, we could estimate unrealized profit if we had current price,
        // but we don't have live data.
      }
      return acc;
    },
    {
      realizedProfit: 0,
      holdingCost: 0,
      totalTrades: 0,
      winningTrades: 0,
      totalVolume: 0,
      totalTax: 0,
      totalFees: 0,
    }
  );

  const winRate = stats.totalTrades > 0 
    ? (stats.winningTrades / stats.totalTrades) * 100 
    : 0;

  // Taiwan convention: Red is profit, Green is loss
  const profitColor = stats.realizedProfit >= 0 ? 'text-red-500' : 'text-green-500';
  const profitIcon = stats.realizedProfit >= 0 ? <TrendingUp className="w-5 h-5 text-red-500" /> : <TrendingDown className="w-5 h-5 text-green-500" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Realized Profit */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <Wallet className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          {profitIcon}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">已實現損益</p>
          <h3 className={`text-2xl font-bold font-mono ${profitColor}`}>
            {stats.realizedProfit > 0 ? '+' : ''}{stats.realizedProfit.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Win Rate */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <PieChart className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">勝率</p>
          <h3 className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {winRate.toFixed(1)}%
          </h3>
          <p className="text-xs text-zinc-400">
            {stats.winningTrades} / {stats.totalTrades} 筆交易
          </p>
        </div>
      </div>

      {/* Costs & Fees */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">TAX</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">交易成本 (稅+手續費)</p>
          <h3 className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {(stats.totalTax + stats.totalFees).toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Holding Cost */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">HOLD</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">庫存成本</p>
          <h3 className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {stats.holdingCost.toLocaleString()}
          </h3>
        </div>
      </div>
    </div>
  );
}
