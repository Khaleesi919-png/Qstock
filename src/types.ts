export type Market = 'TW' | 'US' | 'UK';

export interface Trade {
  id: string;
  market: Market;
  stockSymbol: string;
  stockName: string;
  quantity: number;
  buyDate: string;
  buyPrice: number;
  sellDate?: string;
  sellPrice?: number;
  expectedSellPrice?: number;
  note?: string;
}

export interface TradeCalculations {
  buyAmount: number;
  buyFee: number;
  totalCost: number;
  sellAmount: number;
  sellFee: number;
  tax: number;
  netIncome: number;
  profit: number;
  profitPercent: number;
  isSold: boolean;
  holdingDays: number;
  annualizedReturn: number;
  expectedProfit?: number;
  expectedProfitPercent?: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const calculateTrade = (trade: Trade): TradeCalculations => {
  const isTW = trade.market === 'TW';
  // Fee rates
  const feeRate = isTW ? 0.001425 : 0.001; // TW: 0.1425%, Others: 0.1% (generic est)
  const taxRate = isTW ? 0.003 : 0; // TW: 0.3%, Others: 0%

  const buyAmount = trade.buyPrice * trade.quantity;
  const buyFee = Math.floor(buyAmount * feeRate);
  const totalCost = buyAmount + buyFee;

  // Calculate holding days
  const start = new Date(trade.buyDate).getTime();
  const end = trade.sellDate ? new Date(trade.sellDate).getTime() : new Date().getTime();
  const diffTime = Math.abs(end - start);
  const holdingDays = Math.max(1, Math.ceil(diffTime / MS_PER_DAY)); // At least 1 day

  const calculateSellMetrics = (price: number) => {
    const sAmount = price * trade.quantity;
    const sFee = Math.floor(sAmount * feeRate);
    const sTax = Math.floor(sAmount * taxRate);
    const nIncome = sAmount - sFee - sTax;
    const p = nIncome - totalCost;
    const pPercent = totalCost > 0 ? (p / totalCost) * 100 : 0;
    return { sellAmount: sAmount, sellFee: sFee, tax: sTax, netIncome: nIncome, profit: p, profitPercent: pPercent };
  };

  if (trade.sellPrice !== undefined && trade.sellDate) {
    const metrics = calculateSellMetrics(trade.sellPrice);

    // Annualized Return (CAGR)
    let annualizedReturn = 0;
    if (totalCost > 0 && metrics.netIncome > 0) {
      const totalReturnRatio = metrics.netIncome / totalCost;
      const years = holdingDays / 365;
      annualizedReturn = (Math.pow(totalReturnRatio, 1 / years) - 1) * 100;
    } else if (totalCost > 0) {
       annualizedReturn = -100;
    }

    return {
      buyAmount,
      buyFee,
      totalCost,
      sellAmount: metrics.sellAmount,
      sellFee: metrics.sellFee,
      tax: metrics.tax,
      netIncome: metrics.netIncome,
      profit: metrics.profit,
      profitPercent: metrics.profitPercent,
      isSold: true,
      holdingDays,
      annualizedReturn,
    };
  }

  // Not sold yet
  let expectedProfit: number | undefined;
  let expectedProfitPercent: number | undefined;

  if (trade.expectedSellPrice !== undefined) {
    const expectedMetrics = calculateSellMetrics(trade.expectedSellPrice);
    expectedProfit = expectedMetrics.profit;
    expectedProfitPercent = expectedMetrics.profitPercent;
  }

  return {
    buyAmount,
    buyFee,
    totalCost,
    sellAmount: 0,
    sellFee: 0,
    tax: 0,
    netIncome: 0,
    profit: 0,
    profitPercent: 0,
    isSold: false,
    holdingDays,
    annualizedReturn: 0,
    expectedProfit,
    expectedProfitPercent,
  };
};
