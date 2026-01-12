/**
 * @description       : Agent Swarm Orchestrator for Cryptocurrency Trading
 *                      Coordinates three specialized agents: PriceFetcher, Analyzer, Executor
 * @author            : Troy Amyett
 * @group             : AgentForce Legend
 * @last modified on  : 01-11-2026
 **/
public with sharing class GeckoSwarm {

    // Supported cryptocurrency tickers mapped to CoinGecko IDs
    public static final Map<String, String> TICKER_TO_GECKO_ID = new Map<String, String>{
        'BTC' => 'bitcoin',
        'ETH' => 'ethereum',
        'SOL' => 'solana',
        'XRP' => 'ripple',
        'ADA' => 'cardano',
        'DOGE' => 'dogecoin',
        'DOT' => 'polkadot',
        'LINK' => 'chainlink',
        'LTC' => 'litecoin',
        'MATIC' => 'matic-network',
        'BNB' => 'binancecoin'
    };

    // Signal thresholds (moved to outer class)
    private static final Decimal STRONG_BUY_THRESHOLD = 2.0;
    private static final Decimal BUY_THRESHOLD = 0.5;
    private static final Decimal SELL_THRESHOLD = -0.5;
    private static final Decimal STRONG_SELL_THRESHOLD = -2.0;

    // ============================================
    // DATA STRUCTURES
    // ============================================

    public class SwarmRequest {
        @InvocableVariable(label='Symbols' description='Comma-separated crypto symbols (e.g., BTC,ETH,SOL). Defaults to BTC.')
        public String symbols;
    }

    public class SwarmResult {
        @InvocableVariable public String executionId;
        @InvocableVariable public Boolean success;
        @InvocableVariable public String errorMessage;
        @InvocableVariable public String summary;
        @InvocableVariable public Datetime startTime;
        @InvocableVariable public Datetime endTime;
        @InvocableVariable public List<TradingSignal> tradingSignals;
        @InvocableVariable public List<String> agentLogs;
    }

    public class TradingSignal {
        @InvocableVariable public String symbol;
        @InvocableVariable public Decimal currentPrice;
        @InvocableVariable public Decimal previousPrice;
        @InvocableVariable public Decimal changePercent;
        @InvocableVariable public String signal;
        @InvocableVariable public String confidence;
        @InvocableVariable public String momentum;
    }

    public class PriceFetcherResult {
        public Boolean success;
        public String errorMessage;
        public Map<String, Decimal> prices;
        public Datetime fetchTime;
    }

    public class AnalysisSignal {
        public String symbol;
        public Decimal currentPrice;
        public Decimal previousPrice;
        public Decimal changePercent;
        public String recommendation;
        public String confidence;
        public String momentum;
        public Datetime analysisTime;
    }

    public class AnalyzerResult {
        public Boolean analysisComplete;
        public List<AnalysisSignal> signals;
    }

    public class ExecutorResult {
        public Boolean success;
        public String errorMessage;
        public Integer recordsCreated;
        public List<String> executionLogs;
        public Datetime executionTime;
    }

    // ============================================
    // INVOCABLE ENTRY POINT FOR AGENTFORCE/FLOWS
    // ============================================

    @InvocableMethod(label='Execute Crypto Agent Swarm'
                     description='Orchestrates Price Fetcher, Analyzer, and Executor agents for crypto trading signals')
    public static List<SwarmResult> executeSwarm(List<SwarmRequest> requests) {
        List<SwarmResult> results = new List<SwarmResult>();

        if (requests == null || requests.isEmpty()) {
            requests = new List<SwarmRequest>{ new SwarmRequest() };
        }

        for (SwarmRequest request : requests) {
            results.add(runSwarmPipeline(request));
        }

        return results;
    }

    // ============================================
    // MAIN SWARM PIPELINE
    // ============================================

    private static SwarmResult runSwarmPipeline(SwarmRequest request) {
        SwarmResult result = new SwarmResult();
        result.executionId = generateExecutionId();
        result.startTime = System.now();
        result.agentLogs = new List<String>();

        try {
            // Parse requested symbols (default to BTC if none specified)
            List<String> symbols = parseSymbols(request.symbols);
            result.agentLogs.add('[SWARM] Starting pipeline for symbols: ' + String.join(symbols, ', '));

            // ========== AGENT 1: PRICE FETCHER ==========
            result.agentLogs.add('[PRICE_FETCHER] Initiating...');
            PriceFetcherResult fetcherResult = executePriceFetcher(symbols);
            result.agentLogs.add('[PRICE_FETCHER] Fetched ' + fetcherResult.prices.size() + ' prices');

            if (!fetcherResult.success) {
                result.success = false;
                result.errorMessage = 'Price Fetcher failed: ' + fetcherResult.errorMessage;
                result.endTime = System.now();
                return result;
            }

            // ========== AGENT 2: ANALYZER ==========
            result.agentLogs.add('[ANALYZER] Initiating...');
            AnalyzerResult analyzerResult = executeAnalyzer(fetcherResult.prices);
            result.agentLogs.add('[ANALYZER] Generated ' + analyzerResult.signals.size() + ' signals');

            // ========== AGENT 3: EXECUTOR ==========
            result.agentLogs.add('[EXECUTOR] Initiating...');
            ExecutorResult executorResult = executeExecutor(analyzerResult.signals);
            result.agentLogs.add('[EXECUTOR] Recorded ' + executorResult.recordsCreated + ' trading records');

            // Build final result
            result.success = true;
            result.tradingSignals = new List<TradingSignal>();
            for (AnalysisSignal sig : analyzerResult.signals) {
                TradingSignal ts = new TradingSignal();
                ts.symbol = sig.symbol;
                ts.currentPrice = sig.currentPrice;
                ts.previousPrice = sig.previousPrice;
                ts.changePercent = sig.changePercent;
                ts.signal = sig.recommendation;
                ts.confidence = sig.confidence;
                ts.momentum = sig.momentum;
                result.tradingSignals.add(ts);
            }

            result.summary = buildSummary(result.tradingSignals);
            result.agentLogs.add('[SWARM] Pipeline completed successfully');

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = 'Swarm execution failed: ' + e.getMessage();
            result.agentLogs.add('[SWARM] ERROR: ' + e.getMessage());
        }

        result.endTime = System.now();
        return result;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private static List<String> parseSymbols(String symbolsInput) {
        List<String> symbols = new List<String>();

        if (String.isBlank(symbolsInput)) {
            symbols.add('BTC'); // Default
            return symbols;
        }

        for (String s : symbolsInput.split('[,;\\s]+')) {
            String normalized = s.trim().toUpperCase();
            if (TICKER_TO_GECKO_ID.containsKey(normalized)) {
                symbols.add(normalized);
            }
        }

        if (symbols.isEmpty()) {
            symbols.add('BTC');
        }

        return symbols;
    }

    private static String generateExecutionId() {
        return 'SWARM-' + String.valueOf(System.now().getTime()) + '-' + String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 4);
    }

    private static String buildSummary(List<TradingSignal> signals) {
        if (signals == null || signals.isEmpty()) {
            return 'No trading signals generated.';
        }

        Integer buys = 0, sells = 0, holds = 0;
        for (TradingSignal ts : signals) {
            if (ts.signal != null) {
                if (ts.signal.contains('BUY')) buys++;
                else if (ts.signal.contains('SELL')) sells++;
                else holds++;
            }
        }

        return 'Analyzed ' + signals.size() + ' assets: ' + buys + ' BUY, ' + sells + ' SELL, ' + holds + ' HOLD signals.';
    }

    // ============================================
    // PRICE FETCHER AGENT (Static Method)
    // ============================================

    public static PriceFetcherResult executePriceFetcher(List<String> symbols) {
        PriceFetcherResult result = new PriceFetcherResult();
        result.prices = new Map<String, Decimal>();

        try {
            // Build CoinGecko IDs
            Set<String> geckoIds = new Set<String>();
            Map<String, String> idToSymbol = new Map<String, String>();

            for (String sym : symbols) {
                String geckoId = TICKER_TO_GECKO_ID.get(sym);
                if (geckoId != null) {
                    geckoIds.add(geckoId);
                    idToSymbol.put(geckoId, sym);
                }
            }

            if (geckoIds.isEmpty()) {
                result.success = false;
                result.errorMessage = 'No valid symbols provided';
                return result;
            }

            // Call CoinGecko API
            String idsParam = String.join(new List<String>(geckoIds), ',');
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:CoinGecko/api/v3/simple/price?ids=' + EncodingUtil.urlEncode(idsParam, 'UTF-8') + '&vs_currencies=usd');
            req.setMethod('GET');
            req.setTimeout(30000);

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() != 200) {
                result.success = false;
                result.errorMessage = 'CoinGecko API error: HTTP ' + res.getStatusCode();
                return result;
            }

            // Parse response
            Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

            for (String geckoId : geckoIds) {
                if (jsonResponse.containsKey(geckoId)) {
                    Map<String, Object> coinData = (Map<String, Object>) jsonResponse.get(geckoId);
                    Object usdValue = coinData.get('usd');

                    Decimal price;
                    if (usdValue instanceof Decimal) {
                        price = (Decimal) usdValue;
                    } else {
                        price = Decimal.valueOf(String.valueOf(usdValue));
                    }

                    String symbol = idToSymbol.get(geckoId);
                    result.prices.put(symbol, price.setScale(2, RoundingMode.HALF_UP));
                }
            }

            result.success = true;
            result.fetchTime = System.now();

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = 'Price fetch exception: ' + e.getMessage();
        }

        return result;
    }

    // ============================================
    // ANALYZER AGENT (Static Method)
    // ============================================

    public static AnalyzerResult executeAnalyzer(Map<String, Decimal> currentPrices) {
        AnalyzerResult result = new AnalyzerResult();
        result.signals = new List<AnalysisSignal>();

        // Get previous prices from BTC_Price__c
        Map<String, Decimal> previousPrices = getPreviousPrices(currentPrices.keySet());

        for (String symbol : currentPrices.keySet()) {
            AnalysisSignal sig = new AnalysisSignal();
            sig.symbol = symbol;
            sig.currentPrice = currentPrices.get(symbol);
            sig.previousPrice = previousPrices.get(symbol);
            sig.analysisTime = System.now();

            // Calculate change percentage
            if (sig.previousPrice != null && sig.previousPrice > 0) {
                sig.changePercent = ((sig.currentPrice - sig.previousPrice) / sig.previousPrice * 100).setScale(2, RoundingMode.HALF_UP);
            } else {
                sig.changePercent = 0;
            }

            // Generate recommendation
            sig.recommendation = calculateSignal(sig.changePercent);
            sig.confidence = calculateConfidence(sig.changePercent);
            sig.momentum = calculateMomentum(sig.changePercent);

            result.signals.add(sig);
        }

        result.analysisComplete = true;
        return result;
    }

    private static Map<String, Decimal> getPreviousPrices(Set<String> symbols) {
        Map<String, Decimal> prices = new Map<String, Decimal>();

        try {
            for (BTC_Price__c rec : [
                SELECT Symbol__c, Price__c
                FROM BTC_Price__c
                WHERE Symbol__c IN :symbols
                ORDER BY CreatedDate DESC
                LIMIT 100
            ]) {
                if (!prices.containsKey(rec.Symbol__c)) {
                    prices.put(rec.Symbol__c, rec.Price__c);
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Error fetching previous prices: ' + e.getMessage());
        }

        return prices;
    }

    private static String calculateSignal(Decimal changePercent) {
        if (changePercent >= STRONG_BUY_THRESHOLD) return 'STRONG BUY';
        if (changePercent >= BUY_THRESHOLD) return 'BUY';
        if (changePercent <= STRONG_SELL_THRESHOLD) return 'STRONG SELL';
        if (changePercent <= SELL_THRESHOLD) return 'SELL';
        return 'HOLD';
    }

    private static String calculateConfidence(Decimal changePercent) {
        Decimal absChange = Math.abs(changePercent);
        if (absChange >= 5.0) return 'HIGH';
        if (absChange >= 2.0) return 'MEDIUM';
        return 'LOW';
    }

    private static String calculateMomentum(Decimal changePercent) {
        if (changePercent >= 1.0) return 'BULLISH';
        if (changePercent <= -1.0) return 'BEARISH';
        return 'NEUTRAL';
    }

    // ============================================
    // EXECUTOR AGENT (Static Method)
    // ============================================

    public static ExecutorResult executeExecutor(List<AnalysisSignal> signals) {
        ExecutorResult result = new ExecutorResult();
        result.recordsCreated = 0;
        result.executionLogs = new List<String>();

        if (signals == null || signals.isEmpty()) {
            result.success = true;
            result.executionLogs.add('No signals to execute');
            return result;
        }

        List<BTC_Price__c> recordsToInsert = new List<BTC_Price__c>();

        for (AnalysisSignal sig : signals) {
            BTC_Price__c priceRecord = new BTC_Price__c();
            priceRecord.Symbol__c = sig.symbol;
            priceRecord.Price__c = sig.currentPrice;
            priceRecord.Change_Pct__c = sig.changePercent;
            priceRecord.Signal__c = sig.recommendation;

            recordsToInsert.add(priceRecord);
            result.executionLogs.add('Prepared record for ' + sig.symbol + ': ' + sig.recommendation + ' @ $' + sig.currentPrice);
        }

        try {
            // Clean up old records (keep last 24 hours)
            List<BTC_Price__c> oldRecords = [
                SELECT Id FROM BTC_Price__c
                WHERE CreatedDate < :System.now().addHours(-24)
                LIMIT 1000
            ];
            if (!oldRecords.isEmpty()) {
                delete oldRecords;
                result.executionLogs.add('Cleaned up ' + oldRecords.size() + ' old records');
            }

            // Insert new records
            insert recordsToInsert;
            result.recordsCreated = recordsToInsert.size();
            result.success = true;
            result.executionLogs.add('Successfully inserted ' + result.recordsCreated + ' records');

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = 'Executor error: ' + e.getMessage();
            result.executionLogs.add('ERROR: ' + e.getMessage());
        }

        result.executionTime = System.now();
        return result;
    }
}