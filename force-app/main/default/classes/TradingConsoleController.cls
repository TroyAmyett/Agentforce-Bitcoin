/**
 * @description       : Apex controller for Trading Console LWC
 * @author            : Troy Amyett
 * @group             : AgentForce Legend
 * @last modified on  : 01-11-2026
 **/
public with sharing class TradingConsoleController {

    /**
     * @description Executes the Agent Swarm and returns results
     * @param symbols Comma-separated list of crypto symbols
     * @return SwarmResultWrapper containing execution results
     */
    @AuraEnabled
    public static SwarmResultWrapper executeSwarm(String symbols) {
        SwarmResultWrapper wrapper = new SwarmResultWrapper();

        try {
            // Execute the Agent Swarm
            GeckoSwarm.SwarmRequest request = new GeckoSwarm.SwarmRequest();
            request.symbols = String.isBlank(symbols) ? 'BTC,ETH,SOL' : symbols;

            List<GeckoSwarm.SwarmResult> results = GeckoSwarm.executeSwarm(
                new List<GeckoSwarm.SwarmRequest>{ request }
            );

            if (!results.isEmpty()) {
                GeckoSwarm.SwarmResult result = results[0];
                wrapper.success = result.success;
                wrapper.executionId = result.executionId;
                wrapper.summary = result.summary;
                wrapper.errorMessage = result.errorMessage;

                // Convert trading signals
                if (result.tradingSignals != null) {
                    wrapper.tradingSignals = new List<TradingSignalWrapper>();
                    for (GeckoSwarm.TradingSignal sig : result.tradingSignals) {
                        TradingSignalWrapper sigWrapper = new TradingSignalWrapper();
                        sigWrapper.symbol = sig.symbol;
                        sigWrapper.currentPrice = sig.currentPrice;
                        sigWrapper.previousPrice = sig.previousPrice;
                        sigWrapper.changePercent = sig.changePercent;
                        sigWrapper.signal = sig.signal;
                        sigWrapper.confidence = sig.confidence;
                        sigWrapper.momentum = sig.momentum;
                        wrapper.tradingSignals.add(sigWrapper);

                        // Create Trade record for BUY/SELL signals
                        if (sig.signal != null && !sig.signal.contains('HOLD')) {
                            createTradeRecord(sig, result.executionId);
                        }
                    }
                }
            }
        } catch (Exception e) {
            wrapper.success = false;
            wrapper.errorMessage = 'Swarm execution failed: ' + e.getMessage();
        }

        return wrapper;
    }

    /**
     * @description Gets the latest prices from BTC_Price__c
     * @return List of BTC_Price__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<BTC_Price__c> getLatestPrices() {
        // Get the most recent price for each symbol
        Map<String, BTC_Price__c> latestBySymbol = new Map<String, BTC_Price__c>();

        for (BTC_Price__c price : [
            SELECT Id, Symbol__c, Price__c, Change_Pct__c, Signal__c, CreatedDate
            FROM BTC_Price__c
            ORDER BY CreatedDate DESC
            LIMIT 100
        ]) {
            if (!latestBySymbol.containsKey(price.Symbol__c)) {
                latestBySymbol.put(price.Symbol__c, price);
            }
        }

        return latestBySymbol.values();
    }

    /**
     * @description Gets recent trades
     * @return List of Trade__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Trade__c> getRecentTrades() {
        return [
            SELECT Id, Name, Symbol__c, Action__c, Price__c, Quantity__c,
                   Signal_Strength__c, Momentum__c, Change_Percent__c,
                   Executed_At__c, Agent_Execution_Id__c
            FROM Trade__c
            ORDER BY Executed_At__c DESC
            LIMIT 20
        ];
    }

    /**
     * @description Creates a Trade record from a trading signal
     */
    private static void createTradeRecord(GeckoSwarm.TradingSignal signal, String executionId) {
        try {
            Trade__c trade = new Trade__c();
            trade.Symbol__c = signal.symbol;
            trade.Price__c = signal.currentPrice;
            trade.Change_Percent__c = signal.changePercent != null ? signal.changePercent / 100 : 0;
            trade.Agent_Execution_Id__c = executionId;
            trade.Executed_At__c = Datetime.now();

            // Determine action based on signal
            if (signal.signal != null) {
                if (signal.signal.contains('BUY')) {
                    trade.Action__c = 'BUY';
                } else if (signal.signal.contains('SELL')) {
                    trade.Action__c = 'SELL';
                } else {
                    trade.Action__c = 'HOLD';
                }
            }

            // Set signal strength
            if (signal.confidence != null) {
                if (signal.confidence == 'HIGH') {
                    trade.Signal_Strength__c = 'STRONG';
                } else if (signal.confidence == 'MEDIUM') {
                    trade.Signal_Strength__c = 'MODERATE';
                } else {
                    trade.Signal_Strength__c = 'WEAK';
                }
            }

            // Set momentum
            trade.Momentum__c = signal.momentum;

            insert trade;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Failed to create trade record: ' + e.getMessage());
        }
    }

    // ============================================
    // WRAPPER CLASSES
    // ============================================

    public class SwarmResultWrapper {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String executionId;
        @AuraEnabled public String summary;
        @AuraEnabled public String errorMessage;
        @AuraEnabled public List<TradingSignalWrapper> tradingSignals;
    }

    public class TradingSignalWrapper {
        @AuraEnabled public String symbol;
        @AuraEnabled public Decimal currentPrice;
        @AuraEnabled public Decimal previousPrice;
        @AuraEnabled public Decimal changePercent;
        @AuraEnabled public String signal;
        @AuraEnabled public String confidence;
        @AuraEnabled public String momentum;
    }
}