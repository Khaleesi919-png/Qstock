const DB_URL = 'https://stock-bc947-default-rtdb.firebaseio.com/trades';

// --- State ---
let trades = [];
let currentMarket = 'TW';
let sortConfig = { key: 'date', direction: 'desc' };
let editingId = null;
let originalEditingQuantity = 0;

// --- Constants ---
const MARKETS = ['TW', 'US', 'UK', 'BOND'];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("App initialized");
    
    // Setup Event Listeners
    setupEventListeners();
    
    // Initial Fetch
    fetchTrades();
    
    // Initial Render
    renderMarketTabs();
    
    // Lucide Icons
    if (window.lucide) window.lucide.createIcons();
});

function setupEventListeners() {
    // Sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            handleSort(key);
        });
    });

    // Table Actions (Edit/Delete) - Event Delegation
    const tbody = document.getElementById('transactionTableBody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit');
            const deleteBtn = e.target.closest('.btn-delete');

            if (editBtn) {
                const id = editBtn.dataset.id;
                openEditModal(id);
            } else if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                deleteTrade(id);
            }
        });
    }
}

// --- API ---

async function fetchTrades() {
    try {
        const res = await fetch(`${DB_URL}.json`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (data) {
            trades = Object.keys(data).map(key => {
                let t = { ...data[key], id: key };
                if ((t.stockSymbol === 'PBI-B' || t.stockSymbol === 'BHFAL' || t.stockName === 'PBI-B' || t.stockName === 'BHFAL') && t.market !== 'BOND') {
                    t.market = 'BOND';
                    fetch(`${DB_URL}/${key}.json`, {
                        method: 'PATCH',
                        body: JSON.stringify({ market: 'BOND' }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return t;
            });
        } else {
            trades = [];
        }
        renderApp();
    } catch (error) {
        console.error("Error fetching trades:", error);
        // Fallback to empty state, don't alert aggressively on load
        trades = [];
        renderApp();
    }
}

async function saveTrade(trade, shouldClose = true) {
    console.log("Saving trade:", trade);
    try {
        if (trade.id) {
            // Update
            const { id, ...updates } = trade;
            await fetch(`${DB_URL}/${id}.json`, {
                method: 'PATCH',
                body: JSON.stringify(updates),
                headers: { 'Content-Type': 'application/json' }
            });
            // Optimistic update
            trades = trades.map(t => t.id === id ? { ...t, ...updates } : t);
        } else {
            // Create
            const res = await fetch(`${DB_URL}.json`, {
                method: 'POST',
                body: JSON.stringify(trade),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            trades.unshift({ ...trade, id: data.name });
        }
        
        if (shouldClose) {
            closeModal();
            renderApp();
        }
    } catch (error) {
        console.error("Error saving trade:", error);
        alert("儲存失敗，請檢查網路連線");
    }
}

async function deleteTrade(id) {
    console.log("Delete requested for ID:", id);
    if (!confirm('確定要刪除這筆交易嗎？')) return;
    
    try {
        await fetch(`${DB_URL}/${id}.json`, { method: 'DELETE' });
        trades = trades.filter(t => t.id !== id);
        renderApp();
    } catch (error) {
        console.error("Error deleting trade:", error);
        alert("刪除失敗");
    }
}

// --- Logic ---

function calculateTrade(trade) {
    const isTW = trade.market === 'TW';
    const feeRate = isTW ? 0.001425 : 0.001;
    const taxRate = isTW ? 0.003 : 0;

    const buyAmount = trade.buyPrice * trade.quantity;
    const buyFee = Math.floor(buyAmount * feeRate);
    const totalCost = buyAmount + buyFee;

    const start = new Date(trade.buyDate).getTime();
    const end = trade.sellDate ? new Date(trade.sellDate).getTime() : new Date().getTime();
    const diffTime = Math.abs(end - start);
    const holdingDays = Math.max(1, Math.ceil(diffTime / MS_PER_DAY));

    const interest = parseFloat(trade.interest) || 0;

    if (trade.type === 'dividend') {
        return {
            isDividend: true,
            interest: interest,
            profit: interest,
            profitPercent: 0,
            totalCost: 0,
            buyAmount: 0, buyFee: 0, holdingDays: 0,
            isSold: false, sellAmount: 0, sellFee: 0, tax: 0, netIncome: 0, annualizedReturn: 0
        };
    }

    const result = {
        buyAmount, buyFee, totalCost, holdingDays, interest,
        isSold: false,
        sellAmount: 0, sellFee: 0, tax: 0, netIncome: 0, profit: 0, profitPercent: 0, annualizedReturn: 0
    };

    const calcMetrics = (price) => {
        const sAmount = price * trade.quantity;
        const sFee = Math.floor(sAmount * feeRate);
        const sTax = Math.floor(sAmount * taxRate);
        const nIncome = sAmount - sFee - sTax;
        const p = nIncome - totalCost;
        const pPercent = totalCost > 0 ? (p / totalCost) * 100 : 0;
        return { sAmount, sFee, sTax, nIncome, p, pPercent };
    };

    if (trade.sellPrice && trade.sellDate) {
        const m = calcMetrics(trade.sellPrice);
        result.isSold = true;
        result.sellAmount = m.sAmount;
        result.sellFee = m.sFee;
        result.tax = m.sTax;
        result.netIncome = m.nIncome;
        result.profit = m.p + interest;
        result.profitPercent = totalCost > 0 ? (result.profit / totalCost) * 100 : 0;

        if (totalCost > 0 && (m.nIncome + interest) > 0) {
            const totalReturnRatio = (m.nIncome + interest) / totalCost;
            const years = holdingDays / 365;
            result.annualizedReturn = (Math.pow(totalReturnRatio, 1 / years) - 1) * 100;
        } else if (totalCost > 0) {
            result.annualizedReturn = -100;
        }
    } else {
        result.profit = interest;
        result.profitPercent = totalCost > 0 ? (interest / totalCost) * 100 : 0;
        if (totalCost > 0 && interest > 0) {
            const totalReturnRatio = (totalCost + interest) / totalCost;
            const years = holdingDays / 365;
            result.annualizedReturn = (Math.pow(totalReturnRatio, 1 / years) - 1) * 100;
        }
        
        if (trade.expectedSellPrice) {
            const m = calcMetrics(trade.expectedSellPrice);
            result.expectedProfit = m.p + interest;
            result.expectedProfitPercent = totalCost > 0 ? (result.expectedProfit / totalCost) * 100 : 0;
        }
    }

    return result;
}

// --- Rendering ---

function renderApp() {
    renderMarketTabs();
    const filteredTrades = trades.filter(t => (t.market || 'TW') === currentMarket);
    renderSummary(filteredTrades);
    renderList(filteredTrades);
    if (window.lucide) window.lucide.createIcons();
}

function renderMarketTabs() {
    const container = document.getElementById('marketTabs');
    if (!container) return;
    container.innerHTML = MARKETS.map(m => `
        <button onclick="setMarket('${m}')" 
            class="px-6 py-2 rounded-lg text-sm font-medium transition-colors ${currentMarket === m ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}">
            ${m === 'TW' ? '台股' : m === 'US' ? '美股' : m === 'UK' ? '英股' : '債券'}
        </button>
    `).join('');
    
    const titleEl = document.getElementById('listTitle');
    if (titleEl) titleEl.textContent = `交易明細 (${currentMarket === 'TW' ? '台股' : currentMarket === 'US' ? '美股' : currentMarket === 'UK' ? '英股' : '債券'})`;
}

function renderSummary(filteredTrades) {
    if (currentMarket === 'BOND') {
        renderBondSummary(filteredTrades);
        return;
    }

    const stats = filteredTrades.reduce((acc, trade) => {
        const calc = calculateTrade(trade);
        if (calc.isDividend) {
            acc.realizedProfit += calc.interest;
            return acc;
        }
        if (calc.isSold) {
            acc.realizedProfit += calc.profit;
            acc.realizedCost += calc.totalCost;
            acc.totalTrades += 1;
            if (calc.profit > 0) acc.winningTrades += 1;
            acc.totalTax += calc.tax;
            acc.totalFees += calc.buyFee + calc.sellFee;
        } else {
            acc.holdingCost += calc.totalCost;
            if (calc.interest > 0) {
                acc.realizedProfit += calc.interest;
                acc.realizedCost += calc.totalCost;
            }
            if (calc.expectedProfit !== undefined) {
                acc.expectedProfit += calc.expectedProfit;
                acc.expectedCost += calc.totalCost;
            }
        }
        return acc;
    }, { 
        realizedProfit: 0, realizedCost: 0, 
        holdingCost: 0, 
        expectedProfit: 0, expectedCost: 0,
        totalTrades: 0, winningTrades: 0, totalTax: 0, totalFees: 0 
    });

    // 1. Realized Return Rate
    const realizedROI = stats.realizedCost > 0 ? (stats.realizedProfit / stats.realizedCost) * 100 : 0;

    // 2. Total Profit (Realized + Estimated)
    const totalProfit = stats.realizedProfit + stats.expectedProfit;
    const totalCostForROI = stats.realizedCost + stats.expectedCost;
    const totalROI = totalCostForROI > 0 ? (totalProfit / totalCostForROI) * 100 : 0;

    const winRate = stats.totalTrades > 0 ? (stats.winningTrades / stats.totalTrades) * 100 : 0;
    
    // Formatting helpers
    const getProfitColor = (val) => val >= 0 ? 'text-red-500' : 'text-green-500';
    const getProfitIcon = (val) => val >= 0 ? 'trending-up' : 'trending-down';

    const realizedColor = getProfitColor(stats.realizedProfit);
    const totalColor = getProfitColor(totalProfit);

    const cards = [
        {
            icon: 'wallet', title: '已實現損益', 
            value: `${stats.realizedProfit > 0 ? '+' : ''}${stats.realizedProfit.toLocaleString()}`,
            valClass: realizedColor,
            sub: `報酬率: ${realizedROI.toFixed(2)}%`,
            rightIcon: `<i data-lucide="${getProfitIcon(stats.realizedProfit)}" class="w-5 h-5 ${realizedColor}"></i>`
        },
        {
            icon: 'calculator', title: '含試算損益',
            value: `${totalProfit > 0 ? '+' : ''}${totalProfit.toLocaleString()}`,
            valClass: totalColor,
            sub: `含試算報酬率: ${totalROI.toFixed(2)}%`,
            rightIcon: `<i data-lucide="${getProfitIcon(totalProfit)}" class="w-5 h-5 ${totalColor}"></i>`
        },
        {
            icon: 'pie-chart', title: '勝率',
            value: `${winRate.toFixed(1)}%`,
            valClass: 'text-zinc-900',
            sub: `${stats.winningTrades} / ${stats.totalTrades} 筆交易`
        },
        {
            icon: 'coins', title: '交易成本',
            value: (stats.totalTax + stats.totalFees).toLocaleString(),
            valClass: 'text-zinc-900',
            sub: '稅 + 手續費'
        },
        {
            icon: 'briefcase', title: '庫存成本',
            value: stats.holdingCost.toLocaleString(),
            valClass: 'text-zinc-900',
            sub: null
        }
    ];

    const summaryEl = document.getElementById('summaryCards');
    if (summaryEl) {
        summaryEl.innerHTML = cards.map(c => `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div class="flex justify-between items-start mb-4">
                    <div class="p-2 bg-zinc-50 rounded-lg">
                        <i data-lucide="${c.icon}" class="w-5 h-5 text-zinc-600"></i>
                    </div>
                    ${c.rightIcon || ''}
                </div>
                <div class="space-y-1">
                    <p class="text-sm font-medium text-zinc-500">${c.title}</p>
                    <h3 class="text-2xl font-bold font-mono ${c.valClass}">${c.value}</h3>
                    ${c.sub ? `<p class="text-xs text-zinc-400">${c.sub}</p>` : ''}
                </div>
            </div>
        `).join('');
    }
}

function renderBondSummary(filteredTrades) {
    const container = document.getElementById('summaryCards');
    if (!container) return;

    if (filteredTrades.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-zinc-500 py-8">尚無債券紀錄</div>';
        return;
    }

    const bonds = {};

    filteredTrades.forEach(trade => {
        const symbol = trade.stockSymbol || trade.stockName;
        if (!bonds[symbol]) {
            bonds[symbol] = {
                name: trade.stockName,
                totalShares: 0,
                totalInterest: 0,
                holdingCost: 0,
                totalHoldingDays: 0,
                activeTrades: 0,
                realizedProfitWithoutInterest: 0,
                realizedCostWithoutInterest: 0
            };
        }
        
        const calc = calculateTrade(trade);
        
        if (calc.isDividend) {
            bonds[symbol].totalInterest += calc.interest;
        } else if (calc.isSold) {
            bonds[symbol].realizedProfitWithoutInterest += (calc.profit - calc.interest);
            bonds[symbol].realizedCostWithoutInterest += calc.totalCost;
            bonds[symbol].totalInterest += calc.interest;
        } else {
            bonds[symbol].totalShares += parseFloat(trade.quantity);
            bonds[symbol].holdingCost += calc.totalCost;
            bonds[symbol].totalInterest += calc.interest;
            bonds[symbol].totalHoldingDays += calc.holdingDays;
            bonds[symbol].activeTrades += 1;
        }
    });

    const cardsHtml = Object.keys(bonds).map(symbol => {
        const b = bonds[symbol];
        
        // Calculate annualized returns
        // We use average holding years for active trades
        const avgYears = b.activeTrades > 0 ? (b.totalHoldingDays / b.activeTrades) / 365 : 0;
        
        let annReturnWith = 0;
        let annReturnWithout = 0;

        const totalCost = b.holdingCost + b.realizedCostWithoutInterest;
        const totalProfitWithout = b.realizedProfitWithoutInterest;
        const totalProfitWith = totalProfitWithout + b.totalInterest;

        if (totalCost > 0 && avgYears > 0) {
            const ratioWithout = (totalCost + totalProfitWithout) / totalCost;
            annReturnWithout = (Math.pow(ratioWithout, 1 / avgYears) - 1) * 100;

            const ratioWith = (totalCost + totalProfitWith) / totalCost;
            annReturnWith = (Math.pow(ratioWith, 1 / avgYears) - 1) * 100;
        } else if (totalCost > 0 && avgYears === 0 && b.realizedCostWithoutInterest > 0) {
            // If all sold, we can't easily calculate annualized return without knowing exact holding days of sold ones.
            // Let's just show total return % instead of annualized if avgYears is 0.
            annReturnWithout = (totalProfitWithout / totalCost) * 100;
            annReturnWith = (totalProfitWith / totalCost) * 100;
        }

        const getProfitColor = (val) => val >= 0 ? 'text-red-500' : 'text-green-500';
        
        const avgBuyPrice = b.totalShares > 0 ? b.holdingCost / b.totalShares : 0;

        return `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-zinc-100 flex flex-col justify-between col-span-1 md:col-span-2">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-3">
                        <div class="p-3 bg-zinc-900 rounded-xl text-white shadow-md shadow-zinc-900/10">
                            <i data-lucide="landmark" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-zinc-500">${b.name} ${symbol !== b.name ? `(${symbol})` : ''}</p>
                            <h3 class="text-2xl font-bold font-mono tracking-tight text-zinc-900 mt-1">${b.totalShares.toLocaleString()} <span class="text-sm font-sans font-normal text-zinc-500">股</span></h3>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-y-4 gap-x-6 mt-2 pt-4 border-t border-zinc-100">
                    <div>
                        <p class="text-xs font-medium text-zinc-500 mb-1">庫存成本</p>
                        <p class="text-base font-mono font-semibold text-zinc-900">${b.holdingCost.toLocaleString()}</p>
                    </div>
                    <div>
                        <p class="text-xs font-medium text-zinc-500 mb-1">平均買入成本</p>
                        <p class="text-base font-mono font-semibold text-zinc-900">${avgBuyPrice.toFixed(2)}</p>
                    </div>
                    <div>
                        <p class="text-xs font-medium text-zinc-500 mb-1">總計利息</p>
                        <p class="text-base font-mono font-semibold text-green-600">+${b.totalInterest.toLocaleString()}</p>
                    </div>
                    <div>
                        <p class="text-xs font-medium text-zinc-500 mb-1">年化報酬 (含息)</p>
                        <p class="text-base font-mono font-semibold ${getProfitColor(annReturnWith)}">${annReturnWith > 0 ? '+' : ''}${annReturnWith.toFixed(2)}%</p>
                    </div>
                    <div>
                        <p class="text-xs font-medium text-zinc-500 mb-1">年化報酬 (不含息)</p>
                        <p class="text-base font-mono font-semibold ${getProfitColor(annReturnWithout)}">${annReturnWithout > 0 ? '+' : ''}${annReturnWithout.toFixed(2)}%</p>
                    </div>
                </div>
                
                <div class="mt-4 pt-4 border-t border-zinc-100">
                    <label class="text-xs font-medium text-blue-600 flex items-center gap-2 mb-2">
                        試算賣出價格 <span class="text-[10px] text-blue-400/80 font-normal">(輸入目標價)</span>
                    </label>
                    <div class="flex flex-col gap-3">
                        <input type="number" step="0.01" placeholder="例如: 25.5" 
                            oninput="calculateBondExpected(this, ${b.totalShares}, ${b.holdingCost}, ${b.realizedCostWithoutInterest}, ${totalProfitWithout}, ${b.totalInterest}, ${avgYears})" 
                            class="w-full px-3 py-2 text-sm rounded-lg border border-blue-200 bg-blue-50/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-blue-700 placeholder-blue-300">
                        
                        <div class="hidden expected-bond-result grid grid-cols-2 gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                            <div>
                                <p class="text-[10px] font-medium text-blue-600 mb-1">現值 (不含息)</p>
                                <p class="text-sm font-mono font-bold text-blue-900 expected-val-without"></p>
                                <p class="text-[10px] font-mono font-medium expected-roi-without mt-0.5"></p>
                            </div>
                            <div>
                                <p class="text-[10px] font-medium text-blue-600 mb-1">現值 (含息)</p>
                                <p class="text-sm font-mono font-bold text-blue-900 expected-val-with"></p>
                                <p class="text-[10px] font-mono font-medium expected-roi-with mt-0.5"></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = cardsHtml;
    lucide.createIcons();
}

function renderList(filteredTrades) {
    const countEl = document.getElementById('recordCount');
    if (countEl) countEl.textContent = `${filteredTrades.length} 筆紀錄`;
    
    // Sort
    const sorted = [...filteredTrades].sort((a, b) => {
        const cA = calculateTrade(a);
        const cB = calculateTrade(b);
        let valA, valB;

        switch(sortConfig.key) {
            case 'date': valA = new Date(a.buyDate).getTime(); valB = new Date(b.buyDate).getTime(); break;
            case 'stock': valA = a.stockName; valB = b.stockName; break;
            case 'cost': valA = cA.totalCost; valB = cB.totalCost; break;
            case 'fees': valA = cA.buyFee + cA.sellFee + cA.tax; valB = cB.buyFee + cB.sellFee + cB.tax; break;
            case 'interest': valA = cA.interest; valB = cB.interest; break;
            case 'profit': valA = cA.profit; valB = cB.profit; break;
            case 'profitPercent': valA = cA.profitPercent; valB = cB.profitPercent; break;
            case 'holding': valA = cA.holdingDays; valB = cB.holdingDays; break;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Render Icons
    document.querySelectorAll('.sort-icon').forEach(el => {
        el.classList.add('opacity-30');
        el.setAttribute('data-lucide', 'arrow-up-down');
    });
    const activeIcon = document.getElementById(`sort-${sortConfig.key}`);
    if (activeIcon) {
        activeIcon.classList.remove('opacity-30');
        activeIcon.setAttribute('data-lucide', sortConfig.direction === 'asc' ? 'arrow-up' : 'arrow-down');
    }

    const tbody = document.getElementById('transactionTableBody');
    if (!tbody) return;

    if (sorted.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-zinc-400">尚無交易紀錄</td></tr>`;
        return;
    }

    tbody.innerHTML = sorted.map(trade => {
        const calc = calculateTrade(trade);
        const profitColor = calc.profit >= 0 ? 'text-red-500' : 'text-green-500';
        const profitBg = calc.profit >= 0 ? 'bg-red-50' : 'bg-green-50';
        
        // Sell Price Cell
        let sellPriceHtml;
        if (calc.isSold) {
            sellPriceHtml = `<span class="text-zinc-900">${Number(trade.sellPrice).toLocaleString()}</span>`;
        } else {
            sellPriceHtml = `<div class="flex flex-col items-end"><span class="text-zinc-300">-</span>`;
            if (trade.expectedSellPrice) {
                sellPriceHtml += `<span class="text-xs text-blue-500 font-medium border-b border-dashed border-blue-300">預: ${Number(trade.expectedSellPrice).toLocaleString()}</span>`;
            }
            sellPriceHtml += `</div>`;
        }

        // Fees Cell
        const totalFees = calc.buyFee + calc.sellFee + calc.tax;
        let feesHtml = `<span class="text-zinc-500 font-mono text-sm">${totalFees.toLocaleString()}</span>`;
        if (!calc.isSold && calc.expectedProfit !== undefined) {
             feesHtml = `<span class="text-zinc-500 font-mono text-sm">${(calc.buyFee + calc.sellFee + calc.tax).toLocaleString()}</span>`;
        }

        // Interest Cell
        const interestHtml = `<span class="text-zinc-600 font-mono text-sm">${calc.interest > 0 ? calc.interest.toLocaleString() : '-'}</span>`;

        // Profit Cell
        let profitHtml;
        if (calc.isDividend) {
            profitHtml = `<span class="font-bold font-mono text-green-500">+${calc.interest.toLocaleString()}</span>`;
        } else if (calc.isSold) {
            profitHtml = `<span class="font-bold font-mono ${profitColor}">${calc.profit > 0 ? '+' : ''}${calc.profit.toLocaleString()}</span>`;
        } else if (calc.expectedProfit !== undefined) {
            profitHtml = `<span class="font-mono text-sm font-medium text-blue-500"><span class="text-[10px] mr-1">試</span>${calc.expectedProfit > 0 ? '+' : ''}${calc.expectedProfit.toLocaleString()}</span>`;
        } else if (calc.interest > 0) {
            profitHtml = `<span class="font-bold font-mono text-green-500">+${calc.interest.toLocaleString()}</span>`;
        } else {
            profitHtml = `<span class="text-zinc-300">-</span>`;
        }

        // Percent Cell
        let percentHtml;
        if (calc.isDividend) {
            percentHtml = `<span class="text-xs px-2 py-1 rounded-full bg-zinc-100 text-zinc-500">領息</span>`;
        } else if (calc.isSold) {
            percentHtml = `<span class="text-xs px-2 py-1 rounded font-mono font-medium ${profitBg} ${profitColor}">${calc.profitPercent.toFixed(2)}%</span>`;
        } else if (calc.expectedProfitPercent !== undefined) {
            percentHtml = `<span class="text-xs px-2 py-1 rounded font-mono font-medium bg-blue-50 text-blue-600">${calc.expectedProfitPercent.toFixed(2)}%</span>`;
        } else if (calc.interest > 0) {
            percentHtml = `<span class="text-xs px-2 py-1 rounded font-mono font-medium bg-green-50 text-green-500">${calc.profitPercent.toFixed(2)}%</span>`;
        } else {
            percentHtml = `<span class="text-xs px-2 py-1 rounded-full bg-zinc-100 text-zinc-500">庫存中</span>`;
        }

        if (calc.isDividend) {
            return `
                <tr class="group hover:bg-zinc-50 transition-colors">
                    <td class="p-4 text-sm text-zinc-600 whitespace-nowrap">
                        <div>${trade.buyDate}</div>
                    </td>
                    <td class="p-4 whitespace-nowrap">
                        <div class="font-medium text-zinc-900">${trade.stockName}</div>
                        ${trade.stockSymbol ? `<div class="text-xs text-zinc-400 font-mono">${trade.stockSymbol}</div>` : ''}
                    </td>
                    <td class="p-4 whitespace-nowrap text-center text-zinc-400">-</td>
                    <td class="p-4 text-center text-zinc-400">-</td>
                    <td class="p-4 text-center text-zinc-400">-</td>
                    <td class="p-4 text-center text-zinc-400">-</td>
                    <td class="p-4 text-center text-zinc-400">-</td>
                    <td class="p-4 text-center text-zinc-400">-</td>
                    <td class="p-4 text-right whitespace-nowrap">${interestHtml}</td>
                    <td class="p-4 text-right whitespace-nowrap">${profitHtml}</td>
                    <td class="p-4 text-right whitespace-nowrap">${percentHtml}</td>
                    <td class="p-4 text-center whitespace-nowrap">
                        <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="openEditModal('${trade.id}')" class="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯">
                                <i data-lucide="edit-2" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteTrade('${trade.id}')" class="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="刪除">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }

        return `
            <tr class="group hover:bg-zinc-50 transition-colors">
                <td class="p-4 text-sm text-zinc-600 whitespace-nowrap">
                    <div>${trade.buyDate}</div>
                    ${trade.sellDate ? `<div class="text-xs text-zinc-400">➜ ${trade.sellDate}</div>` : ''}
                </td>
                <td class="p-4 whitespace-nowrap">
                    <div class="font-medium text-zinc-900">${trade.stockName}</div>
                    ${trade.stockSymbol ? `<div class="text-xs text-zinc-400 font-mono">${trade.stockSymbol}</div>` : ''}
                </td>
                <td class="p-4 whitespace-nowrap">
                    <div class="flex items-center gap-1.5 text-sm text-zinc-600">
                        <i data-lucide="clock" class="w-3.5 h-3.5 text-zinc-400"></i>
                        <span class="font-mono">${calc.holdingDays}天</span>
                    </div>
                    ${(calc.isSold || calc.interest > 0) ? `<div class="text-[10px] text-zinc-400 mt-0.5">年化: ${calc.annualizedReturn.toFixed(1)}%</div>` : ''}
                </td>
                <td class="p-4 text-right font-mono text-sm text-zinc-600 whitespace-nowrap">
                    ${Number(trade.buyPrice).toLocaleString()}
                </td>
                <td class="p-4 text-right font-mono text-sm text-zinc-600 whitespace-nowrap">
                    ${Number(trade.quantity).toLocaleString()}
                </td>
                <td class="p-4 text-right font-mono text-sm text-zinc-900 whitespace-nowrap">${calc.totalCost.toLocaleString()}</td>
                <td class="p-4 text-right font-mono text-sm whitespace-nowrap">${sellPriceHtml}</td>
                <td class="p-4 text-right whitespace-nowrap">${feesHtml}</td>
                <td class="p-4 text-right whitespace-nowrap">${interestHtml}</td>
                <td class="p-4 text-right whitespace-nowrap">${profitHtml}</td>
                <td class="p-4 text-right whitespace-nowrap">${percentHtml}</td>
                <td class="p-4 text-center whitespace-nowrap">
                    <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="btn-edit p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 rounded-lg" data-id="${trade.id}">
                            <i data-lucide="edit-2" class="w-4 h-4"></i>
                        </button>
                        <button class="btn-delete p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg" data-id="${trade.id}">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Interaction ---

function setMarket(m) {
    currentMarket = m;
    renderApp();
}

function handleSort(key) {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'desc' ? 'asc' : 'desc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'desc';
    }
    renderApp();
}

// --- Modal ---

let formMarket = 'TW';

function openModal() {
    editingId = null;
    originalEditingQuantity = 0;
    formMarket = currentMarket;
    document.getElementById('modalTitle').textContent = '新增交易';
    document.getElementById('transactionForm').reset();
    document.getElementById('buyDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('quantity').value = 1000;
    document.getElementById('interest').value = '';
    document.querySelector('input[name="tradeType"][value="trade"]').checked = true;
    toggleTradeType();
    renderFormMarketTabs();
    toggleExpectedInput();
    document.getElementById('transactionModal').classList.remove('hidden');
}

function openEditModal(tradeId) {
    console.log("Opening edit modal for:", tradeId);
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) {
        console.error("Trade not found:", tradeId);
        return;
    }

    editingId = trade.id;
    originalEditingQuantity = parseFloat(trade.quantity);
    formMarket = trade.market || 'TW';
    document.getElementById('modalTitle').textContent = '編輯交易';
    document.getElementById('tradeId').value = trade.id;
    
    if (trade.type === 'dividend') {
        document.querySelector('input[name="tradeType"][value="dividend"]').checked = true;
    } else {
        document.querySelector('input[name="tradeType"][value="trade"]').checked = true;
    }
    toggleTradeType();

    renderFormMarketTabs();

    document.getElementById('buyDate').value = trade.buyDate;
    document.getElementById('stockSymbol').value = trade.stockSymbol || '';
    document.getElementById('stockName').value = trade.stockName;
    document.getElementById('buyPrice').value = trade.buyPrice;
    document.getElementById('quantity').value = trade.quantity;
    document.getElementById('sellDate').value = trade.sellDate || '';
    document.getElementById('sellPrice').value = trade.sellPrice || '';
    document.getElementById('expectedSellPrice').value = trade.expectedSellPrice || '';
    document.getElementById('interest').value = trade.interest || '';
    document.getElementById('note').value = trade.note || '';
    
    // Reset sell quantity input
    document.getElementById('sellQuantity').value = '';

    toggleExpectedInput();
    calculateExpected();
    document.getElementById('transactionModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('transactionModal').classList.add('hidden');
}

function renderFormMarketTabs() {
    const el = document.getElementById('formMarketTabs');
    if(el) {
        el.innerHTML = MARKETS.map(m => `
            <button type="button" onclick="setFormMarket('${m}')" 
                class="flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formMarket === m ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}">
                ${m === 'TW' ? '台股' : m === 'US' ? '美股' : m === 'UK' ? '英股' : '債券'}
            </button>
        `).join('');
    }
}

function setFormMarket(m) {
    formMarket = m;
    renderFormMarketTabs();
    calculateExpected();
}

function toggleTradeType() {
    const type = document.querySelector('input[name="tradeType"]:checked').value;
    const tradeOnlyFields = document.getElementById('tradeOnlyFields');
    const dateLabel = document.getElementById('dateLabel');
    const interestLabel = document.getElementById('interestLabel');
    const buyPriceInput = document.getElementById('buyPrice');
    const quantityInput = document.getElementById('quantity');
    const interestInput = document.getElementById('interest');

    if (type === 'dividend') {
        tradeOnlyFields.classList.add('hidden');
        dateLabel.textContent = '入帳日期';
        interestLabel.textContent = '利息金額';
        buyPriceInput.removeAttribute('required');
        quantityInput.removeAttribute('required');
        interestInput.setAttribute('required', 'required');
    } else {
        tradeOnlyFields.classList.remove('hidden');
        dateLabel.textContent = '買入日期';
        interestLabel.textContent = '已收利息 (選填)';
        buyPriceInput.setAttribute('required', 'required');
        quantityInput.setAttribute('required', 'required');
        interestInput.removeAttribute('required');
    }
}

function toggleExpectedInput() {
    const sellDate = document.getElementById('sellDate').value;
    const sellPrice = document.getElementById('sellPrice').value;
    const expectedSection = document.getElementById('expectedSection');
    const sellQuantitySection = document.getElementById('sellQuantitySection');
    
    if (!sellDate && !sellPrice) {
        expectedSection.classList.remove('hidden');
        sellQuantitySection.classList.add('hidden');
    } else {
        expectedSection.classList.add('hidden');
        sellQuantitySection.classList.remove('hidden');
        
        // Pre-fill sell quantity if empty and editing
        const currentSellQty = document.getElementById('sellQuantity').value;
        if (!currentSellQty && editingId) {
             document.getElementById('sellQuantity').value = document.getElementById('quantity').value;
        }
    }
}

function calculateBondExpected(inputEl, totalShares, holdingCost, realizedCostWithoutInterest, realizedProfitWithoutInterest, totalInterest, avgYears) {
    const expectedPrice = parseFloat(inputEl.value);
    const resultDiv = inputEl.nextElementSibling;
    
    if (!expectedPrice || totalShares <= 0) {
        resultDiv.classList.add('hidden');
        return;
    }
    
    // 現值 (不含息) = 預期股價 * 總股數
    const expectedRevenue = expectedPrice * totalShares;
    // 現值 (含息) = 現值 (不含息) + 已領總利息
    const expectedRevenueWithInterest = expectedRevenue + totalInterest;

    // 計算總利潤
    const expectedProfit = expectedRevenue - holdingCost;
    const totalCost = holdingCost + realizedCostWithoutInterest;
    
    const totalProfitWithout = realizedProfitWithoutInterest + expectedProfit;
    const totalProfitWith = totalProfitWithout + totalInterest;
    
    // 計算總報酬率 (不年化，因為使用者想看當前賣出後的整體報酬率)
    const roiWithout = totalCost > 0 ? (totalProfitWithout / totalCost) * 100 : 0;
    const roiWith = totalCost > 0 ? (totalProfitWith / totalCost) * 100 : 0;
    
    resultDiv.classList.remove('hidden');
    
    const valWithoutEl = resultDiv.querySelector('.expected-val-without');
    const roiWithoutEl = resultDiv.querySelector('.expected-roi-without');
    const valWithEl = resultDiv.querySelector('.expected-val-with');
    const roiWithEl = resultDiv.querySelector('.expected-roi-with');
    
    const getProfitColor = (val) => val >= 0 ? 'text-red-600' : 'text-green-600';
    const getSign = (val) => val > 0 ? '+' : '';
    
    valWithoutEl.textContent = expectedRevenue.toLocaleString(undefined, {maximumFractionDigits: 2});
    roiWithoutEl.textContent = `總報酬率: ${getSign(roiWithout)}${roiWithout.toFixed(2)}%`;
    roiWithoutEl.className = `text-[10px] font-mono font-medium expected-roi-without mt-0.5 ${getProfitColor(roiWithout)}`;
    
    valWithEl.textContent = expectedRevenueWithInterest.toLocaleString(undefined, {maximumFractionDigits: 2});
    roiWithEl.textContent = `總報酬率: ${getSign(roiWith)}${roiWith.toFixed(2)}%`;
    roiWithEl.className = `text-[10px] font-mono font-medium expected-roi-with mt-0.5 ${getProfitColor(roiWith)}`;
}

function calculateExpected() {
    const expectedPrice = parseFloat(document.getElementById('expectedSellPrice').value);
    const buyPrice = parseFloat(document.getElementById('buyPrice').value);
    const quantity = parseFloat(document.getElementById('quantity').value);
    
    const resultDiv = document.getElementById('expectedResult');
    
    if (!expectedPrice || !buyPrice || !quantity) {
        resultDiv.classList.add('hidden');
        return;
    }

    // Mock trade object for calculation
    const tempTrade = {
        market: formMarket,
        buyPrice, quantity,
        expectedSellPrice: expectedPrice,
        buyDate: new Date().toISOString(), // Dummy
        stockName: '', stockSymbol: ''
    };

    const calc = calculateTrade(tempTrade);
    
    if (calc.expectedProfit !== undefined) {
        resultDiv.classList.remove('hidden');
        const pVal = document.getElementById('expectedProfitVal');
        const pPct = document.getElementById('expectedProfitPct');
        
        pVal.textContent = `${calc.expectedProfit > 0 ? '+' : ''}${calc.expectedProfit.toLocaleString()}`;
        pPct.textContent = `${calc.expectedProfitPercent.toFixed(2)}%`;
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    console.log("Form submitted");
    
    const type = document.querySelector('input[name="tradeType"]:checked').value;

    // Basic trade data from form
    const trade = {
        type: type,
        market: formMarket,
        buyDate: document.getElementById('buyDate').value,
        stockSymbol: document.getElementById('stockSymbol').value,
        stockName: document.getElementById('stockName').value,
        buyPrice: parseFloat(document.getElementById('buyPrice').value) || 0,
        quantity: parseFloat(document.getElementById('quantity').value) || 0,
        interest: parseFloat(document.getElementById('interest').value) || 0,
        note: document.getElementById('note').value,
    };

    const sellDate = document.getElementById('sellDate').value;
    const sellPrice = document.getElementById('sellPrice').value;
    const expectedSellPrice = document.getElementById('expectedSellPrice').value;
    const sellQuantityInput = document.getElementById('sellQuantity').value;

    if (type !== 'dividend') {
        // Determine Sell Logic
        let isSelling = false;
        let sellQty = trade.quantity; // Default to full sell

        if (sellDate || sellPrice) {
            isSelling = true;
            trade.sellDate = sellDate;
            trade.sellPrice = parseFloat(sellPrice);
            
            if (sellQuantityInput) {
                sellQty = parseFloat(sellQuantityInput);
            }
        } else if (expectedSellPrice) {
            trade.expectedSellPrice = parseFloat(expectedSellPrice);
        }

        console.log("Edit ID:", editingId, "Is Selling:", isSelling, "Sell Qty:", sellQty, "Original Qty:", originalEditingQuantity);

        // Partial Sell Logic
        if (editingId && isSelling && sellQty < originalEditingQuantity) {
            console.log("Partial sell detected");
            if (confirm(`偵測到賣出股數 (${sellQty}) 小於 原持有股數 (${originalEditingQuantity})。\n是否要自動拆分為「已賣出」與「剩餘庫存」兩筆紀錄？`)) {
                
                // 1. Update the SOLD part (this record becomes the sold record)
                trade.id = editingId;
                trade.quantity = sellQty; // Set quantity to sold amount
                await saveTrade(trade, false);

                // 2. Create the REMAINING part (new record)
                const remainingQty = originalEditingQuantity - sellQty;
                const remainingTrade = {
                    ...trade,
                    quantity: remainingQty,
                    note: `(分拆剩餘) ${trade.note || ''}`
                };
                
                // Remove sell info for the remaining part
                delete remainingTrade.sellDate;
                delete remainingTrade.sellPrice;
                delete remainingTrade.expectedSellPrice;
                delete remainingTrade.id; // Ensure it creates a new record

                await saveTrade(remainingTrade, true);
                return;
            }
        }
    }
    
    if (editingId) trade.id = editingId;
    saveTrade(trade);
}

// Expose functions to global scope for static HTML onclicks
window.openModal = openModal;
window.closeModal = closeModal;
window.openEditModal = openEditModal;
window.deleteTrade = deleteTrade;
window.handleFormSubmit = handleFormSubmit;
window.handleSort = handleSort;
window.setMarket = setMarket;
window.toggleExpectedInput = toggleExpectedInput;
window.toggleTradeType = toggleTradeType;
window.calculateExpected = calculateExpected;
window.calculateBondExpected = calculateBondExpected;
window.setFormMarket = setFormMarket;
