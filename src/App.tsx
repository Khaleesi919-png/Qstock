import React, { useState } from 'react';
import { useTransactions } from './hooks/useTransactions';
import { Summary } from './components/Summary';
import { TransactionList } from './components/TransactionList';
import { TransactionForm } from './components/TransactionForm';
import { Plus, TrendingUp } from 'lucide-react';
import { Trade, Market } from './types';
import { motion } from 'motion/react';

function App() {
  const { trades, addTrade, updateTrade, deleteTrade } = useTransactions();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>(undefined);
  const [currentMarket, setCurrentMarket] = useState<Market>('TW');

  const handleAdd = () => {
    setEditingTrade(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (trade: Trade) => {
    setEditingTrade(trade);
    setIsFormOpen(true);
  };

  const handleSubmit = (tradeData: Omit<Trade, 'id'>) => {
    if (editingTrade) {
      updateTrade(editingTrade.id, tradeData);
    } else {
      addTrade(tradeData);
    }
  };

  // Filter trades by market
  const filteredTrades = trades.filter(t => (t.market || 'TW') === currentMarket);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 dark:bg-white rounded-xl flex items-center justify-center shadow-lg shadow-zinc-900/10 dark:shadow-white/10">
              <TrendingUp className="w-6 h-6 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Stock Ledger Pro</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">交易紀錄 & 損益試算</p>
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl font-medium transition-all shadow-lg shadow-zinc-900/20 dark:shadow-white/10 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>記一筆</span>
          </button>
        </header>

        {/* Market Tabs */}
        <div className="flex space-x-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl mb-8 w-fit">
          {(['TW', 'US', 'UK'] as Market[]).map((market) => (
            <button
              key={market}
              onClick={() => setCurrentMarket(market)}
              className={`relative px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentMarket === market
                  ? 'text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {currentMarket === market && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white dark:bg-zinc-800 shadow-sm rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">
                {market === 'TW' ? '台股' : market === 'US' ? '美股' : '英股'}
              </span>
            </button>
          ))}
        </div>

        <Summary trades={filteredTrades} />

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">交易明細 ({currentMarket === 'TW' ? '台股' : currentMarket === 'US' ? '美股' : '英股'})</h2>
            <span className="text-sm text-zinc-500">{filteredTrades.length} 筆紀錄</span>
          </div>
          
          <TransactionList 
            trades={filteredTrades} 
            onEdit={handleEdit} 
            onDelete={deleteTrade} 
          />
        </div>
      </div>

      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        initialData={editingTrade}
        defaultMarket={currentMarket}
      />
    </div>
  );
}

export default App;
