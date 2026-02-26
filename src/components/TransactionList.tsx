import React, { useState, useMemo } from 'react';
import { Trade, calculateTrade, TradeCalculations } from '../types';
import { Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface TransactionListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
}

type SortKey = 'date' | 'stock' | 'cost' | 'profit' | 'profitPercent' | 'holding';
type SortDirection = 'asc' | 'desc';

export function TransactionList({ trades, onEdit, onDelete }: TransactionListProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'desc',
  });

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const sortedTrades = useMemo(() => {
    const sortableItems = trades.map((trade) => ({
      trade,
      calc: calculateTrade(trade),
    }));

    sortableItems.sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.key) {
        case 'date':
          comparison = new Date(a.trade.buyDate).getTime() - new Date(b.trade.buyDate).getTime();
          break;
        case 'stock':
          comparison = a.trade.stockName.localeCompare(b.trade.stockName);
          break;
        case 'cost':
          comparison = a.calc.totalCost - b.calc.totalCost;
          break;
        case 'profit':
          comparison = a.calc.profit - b.calc.profit;
          break;
        case 'profitPercent':
          comparison = a.calc.profitPercent - b.calc.profitPercent;
          break;
        case 'holding':
          comparison = a.calc.holdingDays - b.calc.holdingDays;
          break;
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return sortableItems;
  }, [trades, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const Th = ({ label, sortKey, align = 'left' }: { label: string; sortKey: SortKey; align?: 'left' | 'right' | 'center' }) => (
    <th 
      className={`p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {label}
        <SortIcon columnKey={sortKey} />
      </div>
    </th>
  );

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <Th label="日期" sortKey="date" />
              <Th label="股票" sortKey="stock" />
              <Th label="持有時間" sortKey="holding" />
              <th className="p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">買入價 / 股數</th>
              <Th label="成本" sortKey="cost" align="right" />
              <th className="p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">賣出價</th>
              <Th label="損益金額" sortKey="profit" align="right" />
              <Th label="報酬率" sortKey="profitPercent" align="right" />
              <th className="p-4 text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sortedTrades.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-zinc-400">
                  尚無交易紀錄
                </td>
              </tr>
            ) : (
              sortedTrades.map(({ trade, calc }) => {
                const profitColor = calc.profit >= 0 ? 'text-red-500' : 'text-green-500';
                const profitBg = calc.profit >= 0 ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10';

                return (
                  <motion.tr 
                    key={trade.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
                      <div>{trade.buyDate}</div>
                      {trade.sellDate && <div className="text-xs text-zinc-400">➜ {trade.sellDate}</div>}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{trade.stockName}</div>
                      {trade.stockSymbol && <div className="text-xs text-zinc-400 font-mono">{trade.stockSymbol}</div>}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-mono">{calc.holdingDays}天</span>
                      </div>
                      {calc.isSold && (
                        <div className="text-[10px] text-zinc-400 mt-0.5" title="年化報酬率 (CAGR)">
                          年化: {calc.annualizedReturn.toFixed(1)}%
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono text-sm text-zinc-600 dark:text-zinc-400">
                      <div>{trade.buyPrice.toLocaleString()}</div>
                      <div className="text-xs text-zinc-400">x {trade.quantity.toLocaleString()}</div>
                    </td>
                    <td className="p-4 text-right font-mono text-sm text-zinc-900 dark:text-zinc-100">
                      {calc.totalCost.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-mono text-sm">
                      {calc.isSold ? (
                        <span className="text-zinc-900 dark:text-zinc-100">{trade.sellPrice?.toLocaleString()}</span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-zinc-300 dark:text-zinc-600">-</span>
                          {trade.expectedSellPrice && (
                            <span className="text-xs text-blue-500 font-medium border-b border-dashed border-blue-300 dark:border-blue-700">
                              預: {trade.expectedSellPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {calc.isSold ? (
                        <span className={`font-bold font-mono ${profitColor}`}>
                          {calc.profit > 0 ? '+' : ''}{calc.profit.toLocaleString()}
                        </span>
                      ) : calc.expectedProfit !== undefined ? (
                        <span className="font-mono text-sm font-medium text-blue-500">
                          <span className="text-[10px] mr-1">試</span>
                          {calc.expectedProfit > 0 ? '+' : ''}{calc.expectedProfit.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {calc.isSold ? (
                        <span className={`text-xs px-2 py-1 rounded font-mono font-medium ${profitBg} ${profitColor}`}>
                          {calc.profitPercent.toFixed(2)}%
                        </span>
                      ) : calc.expectedProfitPercent !== undefined ? (
                        <span className="text-xs px-2 py-1 rounded font-mono font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          {calc.expectedProfitPercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          庫存中
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(trade)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(trade.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
