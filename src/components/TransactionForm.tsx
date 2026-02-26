import React, { useState, useEffect, useMemo } from 'react';
import { Trade, Market, calculateTrade } from '../types';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trade: Omit<Trade, 'id'>) => void;
  initialData?: Trade;
  defaultMarket?: Market;
}

export function TransactionForm({ isOpen, onClose, onSubmit, initialData, defaultMarket = 'TW' }: TransactionFormProps) {
  const [formData, setFormData] = useState<Partial<Trade>>({
    market: defaultMarket,
    buyDate: new Date().toISOString().split('T')[0],
    stockSymbol: '',
    stockName: '',
    quantity: 1000,
    buyPrice: 0,
    note: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        market: defaultMarket,
        buyDate: new Date().toISOString().split('T')[0],
        stockSymbol: '',
        stockName: '',
        quantity: 1000,
        buyPrice: 0,
        note: '',
      });
    }
  }, [initialData, isOpen, defaultMarket]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.stockName || !formData.buyPrice || !formData.quantity || !formData.buyDate) return;
    
    onSubmit(formData as Omit<Trade, 'id'>);
    onClose();
  };

  // Calculate expected profit for preview
  const expectedCalculations = useMemo(() => {
    if (
      !formData.sellDate && 
      !formData.sellPrice && 
      formData.expectedSellPrice && 
      formData.buyPrice && 
      formData.quantity &&
      formData.market
    ) {
      // Create a temporary trade object for calculation
      const tempTrade: Trade = {
        id: 'temp',
        market: formData.market,
        stockSymbol: formData.stockSymbol || '',
        stockName: formData.stockName || '',
        quantity: formData.quantity,
        buyDate: formData.buyDate || '',
        buyPrice: formData.buyPrice,
        expectedSellPrice: formData.expectedSellPrice,
      };
      return calculateTrade(tempTrade);
    }
    return null;
  }, [formData]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-zinc-100 dark:border-zinc-800"
        >
          <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {initialData ? '編輯交易' : '新增交易'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Market Selection */}
            <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              {(['TW', 'US', 'UK'] as Market[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormData({ ...formData, market: m })}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    formData.market === m
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {m === 'TW' ? '台股' : m === 'US' ? '美股' : '英股'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">買入日期</label>
                <input
                  type="date"
                  required
                  value={formData.buyDate}
                  onChange={(e) => setFormData({ ...formData, buyDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">股票代號 (選填)</label>
                <input
                  type="text"
                  value={formData.stockSymbol}
                  onChange={(e) => setFormData({ ...formData, stockSymbol: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
                  placeholder="2330"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">股票名稱</label>
              <input
                type="text"
                required
                value={formData.stockName}
                onChange={(e) => setFormData({ ...formData, stockName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
                placeholder="台積電"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">買入價格</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.buyPrice}
                  onChange={(e) => setFormData({ ...formData, buyPrice: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">股數</label>
                <input
                  type="number"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all font-mono"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">賣出資訊 (選填)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">賣出日期</label>
                  <input
                    type="date"
                    value={formData.sellDate || ''}
                    onChange={(e) => setFormData({ ...formData, sellDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">賣出價格</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sellPrice || ''}
                    onChange={(e) => setFormData({ ...formData, sellPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all font-mono"
                    placeholder="尚未賣出"
                  />
                </div>
              </div>
              
              {/* Expected Sell Price - Only show if not sold */}
              {!formData.sellDate && !formData.sellPrice && (
                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    預期賣出價格
                    <span className="text-xs text-blue-400/80 font-normal">(試算用)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.expectedSellPrice || ''}
                    onChange={(e) => setFormData({ ...formData, expectedSellPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none transition-all font-mono text-blue-700 dark:text-blue-300 placeholder-blue-300"
                    placeholder="輸入目標價進行試算"
                  />
                  {expectedCalculations && expectedCalculations.expectedProfit !== undefined && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                      <span className="text-xs text-blue-600 dark:text-blue-400">試算損益:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                          {expectedCalculations.expectedProfit > 0 ? '+' : ''}{expectedCalculations.expectedProfit.toLocaleString()}
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                          {expectedCalculations.expectedProfitPercent?.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">備註</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all resize-none h-20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity"
              >
                {initialData ? '更新' : '新增'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
