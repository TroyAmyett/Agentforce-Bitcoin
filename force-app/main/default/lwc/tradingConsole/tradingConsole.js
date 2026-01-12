import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import executeSwarm from '@salesforce/apex/TradingConsoleController.executeSwarm';
import getLatestPrices from '@salesforce/apex/TradingConsoleController.getLatestPrices';
import getRecentTrades from '@salesforce/apex/TradingConsoleController.getRecentTrades';

export default class TradingConsole extends LightningElement {
    // Configurable property from App Builder
    @api defaultSymbols = 'BTC,ETH,SOL';

    @track prices = [];
    @track signals = [];
    @track trades = [];
    @track isLoading = false;
    @track lastRefresh = null;
    @track executionId = null;
    @track swarmStatus = 'idle'; // idle, running, success, error
    @track errorMessage = null;

    // Selected symbols for analysis (initialized from defaultSymbols)
    @track selectedSymbols;

    // Wired data
    wiredPricesResult;
    wiredTradesResult;

    connectedCallback() {
        // Initialize selectedSymbols from the configurable defaultSymbols property
        this.selectedSymbols = this.defaultSymbols;
    }

    @wire(getLatestPrices)
    wiredPrices(result) {
        this.wiredPricesResult = result;
        if (result.data) {
            this.prices = result.data.map(price => ({
                ...price,
                formattedPrice: this.formatCurrency(price.Price__c),
                changeClass: this.getChangeClass(price.Change_Pct__c),
                signalClass: this.getSignalClass(price.Signal__c),
                formattedChange: this.formatPercent(price.Change_Pct__c)
            }));
            this.lastRefresh = new Date().toLocaleTimeString();
        } else if (result.error) {
            this.showToast('Error', 'Failed to load prices: ' + result.error.body.message, 'error');
        }
    }

    @wire(getRecentTrades)
    wiredTrades(result) {
        this.wiredTradesResult = result;
        if (result.data) {
            this.trades = result.data.map(trade => ({
                ...trade,
                formattedPrice: this.formatCurrency(trade.Price__c),
                actionClass: this.getActionClass(trade.Action__c),
                formattedDate: this.formatDateTime(trade.Executed_At__c)
            }));
        }
    }

    get hasPrices() {
        return this.prices && this.prices.length > 0;
    }

    get hasTrades() {
        return this.trades && this.trades.length > 0;
    }

    get isSwarmRunning() {
        return this.swarmStatus === 'running';
    }

    get statusIcon() {
        switch(this.swarmStatus) {
            case 'running': return 'utility:sync';
            case 'success': return 'utility:success';
            case 'error': return 'utility:error';
            default: return 'utility:refresh';
        }
    }

    get statusVariant() {
        switch(this.swarmStatus) {
            case 'running': return 'brand';
            case 'success': return 'success';
            case 'error': return 'destructive';
            default: return 'neutral';
        }
    }

    handleSymbolChange(event) {
        this.selectedSymbols = event.target.value;
    }

    async handleRunSwarm() {
        this.isLoading = true;
        this.swarmStatus = 'running';
        this.errorMessage = null;

        try {
            const result = await executeSwarm({ symbols: this.selectedSymbols });

            if (result.success) {
                this.swarmStatus = 'success';
                this.executionId = result.executionId;
                this.signals = result.tradingSignals || [];

                this.showToast('Success', result.summary, 'success');

                // Refresh the wired data
                await this.refreshData();
            } else {
                this.swarmStatus = 'error';
                this.errorMessage = result.errorMessage;
                this.showToast('Error', result.errorMessage, 'error');
            }
        } catch (error) {
            this.swarmStatus = 'error';
            this.errorMessage = error.body?.message || error.message || 'Unknown error';
            this.showToast('Error', this.errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleRefresh() {
        this.isLoading = true;
        try {
            await this.refreshData();
            this.showToast('Refreshed', 'Data refreshed successfully', 'success');
        } catch (error) {
            this.showToast('Error', 'Failed to refresh data', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async refreshData() {
        await Promise.all([
            refreshApex(this.wiredPricesResult),
            refreshApex(this.wiredTradesResult)
        ]);
        this.lastRefresh = new Date().toLocaleTimeString();
    }

    // Formatting helpers
    formatCurrency(value) {
        if (value === null || value === undefined) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    formatPercent(value) {
        if (value === null || value === undefined) return '0.00%';
        const sign = value >= 0 ? '+' : '';
        return sign + value.toFixed(2) + '%';
    }

    formatDateTime(value) {
        if (!value) return '-';
        return new Date(value).toLocaleString();
    }

    // CSS class helpers
    getChangeClass(change) {
        if (change > 0) return 'change-positive';
        if (change < 0) return 'change-negative';
        return 'change-neutral';
    }

    getSignalClass(signal) {
        if (!signal) return 'signal-hold';
        if (signal.includes('BUY')) return 'signal-buy';
        if (signal.includes('SELL')) return 'signal-sell';
        return 'signal-hold';
    }

    getActionClass(action) {
        if (action === 'BUY') return 'action-buy';
        if (action === 'SELL') return 'action-sell';
        return 'action-hold';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant
        }));
    }
}