import { useState, useEffect } from 'react';
import { Trade } from '../types';

const DB_URL = 'https://stock-bc947-default-rtdb.firebaseio.com/trades';

export function useTransactions() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    try {
      const res = await fetch(`${DB_URL}.json`);
      const data = await res.json();
      if (data) {
        // Firebase returns an object with keys as IDs
        const loadedTrades = Object.keys(data).map(key => ({
          ...data[key],
          id: key // Ensure ID matches the key
        }));
        setTrades(loadedTrades);
      } else {
        setTrades([]);
      }
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const addTrade = async (trade: Omit<Trade, 'id'>) => {
    try {
      const res = await fetch(`${DB_URL}.json`, {
        method: 'POST',
        body: JSON.stringify(trade),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      // Firebase returns { name: "-N..." }
      const newTrade = { ...trade, id: data.name };
      setTrades((prev) => [newTrade, ...prev]);
    } catch (error) {
      console.error("Error adding trade:", error);
    }
  };

  const updateTrade = async (id: string, updates: Partial<Trade>) => {
    try {
      // Optimistic update
      setTrades((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      
      await fetch(`${DB_URL}/${id}.json`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error("Error updating trade:", error);
      fetchTrades(); // Revert on error
    }
  };

  const deleteTrade = async (id: string) => {
    try {
      // Optimistic update
      setTrades((prev) => prev.filter((t) => t.id !== id));

      await fetch(`${DB_URL}/${id}.json`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error("Error deleting trade:", error);
      fetchTrades(); // Revert on error
    }
  };

  return { trades, addTrade, updateTrade, deleteTrade, loading };
}
