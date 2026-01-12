/**
 * @description       : Test class for GeckoSwarm Agent Swarm Orchestrator
 * @author            : Troy Amyett
 * @group             : AgentForce Legend
 * @last modified on  : 01-11-2026
 **/
@IsTest
private class GeckoSwarmTest {

    // ============================================
    // MOCK HTTP CALLOUT
    // ============================================

    private class MockCoinGeckoSuccess implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('{"bitcoin":{"usd":95000.50},"ethereum":{"usd":3200.75},"solana":{"usd":145.25}}');
            return res;
        }
    }

    private class MockCoinGeckoError implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(429);
            res.setBody('{"error":"Rate limit exceeded"}');
            return res;
        }
    }

    // ============================================
    // SWARM ORCHESTRATOR TESTS
    // ============================================

    @IsTest
    static void testExecuteSwarm_DefaultBTC() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        List<GeckoSwarm.SwarmRequest> requests = new List<GeckoSwarm.SwarmRequest>();
        GeckoSwarm.SwarmRequest req = new GeckoSwarm.SwarmRequest();
        // symbols is null, should default to BTC
        requests.add(req);

        List<GeckoSwarm.SwarmResult> results = GeckoSwarm.executeSwarm(requests);
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Should return one result');
        GeckoSwarm.SwarmResult result = results[0];
        System.assertEquals(true, result.success, 'Swarm should succeed');
        System.assert(result.executionId != null, 'Should have execution ID');
        System.assert(result.tradingSignals != null, 'Should have trading signals');
        System.assert(result.tradingSignals.size() > 0, 'Should have at least one signal');
    }

    @IsTest
    static void testExecuteSwarm_MultipleSymbols() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        GeckoSwarm.SwarmRequest req = new GeckoSwarm.SwarmRequest();
        req.symbols = 'BTC,ETH,SOL';

        List<GeckoSwarm.SwarmResult> results = GeckoSwarm.executeSwarm(
            new List<GeckoSwarm.SwarmRequest>{ req }
        );
        Test.stopTest();

        GeckoSwarm.SwarmResult result = results[0];
        System.assertEquals(true, result.success, 'Swarm should succeed');
        System.assertEquals(3, result.tradingSignals.size(), 'Should have 3 signals for BTC, ETH, SOL');
    }

    @IsTest
    static void testExecuteSwarm_NullRequest() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        List<GeckoSwarm.SwarmResult> results = GeckoSwarm.executeSwarm(null);
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Should return one result with default BTC');
        System.assertEquals(true, results[0].success, 'Should succeed with default');
    }

    @IsTest
    static void testExecuteSwarm_EmptyRequest() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        List<GeckoSwarm.SwarmResult> results = GeckoSwarm.executeSwarm(
            new List<GeckoSwarm.SwarmRequest>()
        );
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Should return one result with default');
    }

    @IsTest
    static void testExecuteSwarm_InvalidSymbols() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        GeckoSwarm.SwarmRequest req = new GeckoSwarm.SwarmRequest();
        req.symbols = 'INVALID,FAKECOIN,NOTREAL';

        List<GeckoSwarm.SwarmResult> results = GeckoSwarm.executeSwarm(
            new List<GeckoSwarm.SwarmRequest>{ req }
        );
        Test.stopTest();

        // Should fall back to BTC when no valid symbols found
        GeckoSwarm.SwarmResult result = results[0];
        System.assertEquals(true, result.success, 'Should succeed with fallback to BTC');
    }

    @IsTest
    static void testExecuteSwarm_APIError() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoError());

        Test.startTest();
        GeckoSwarm.SwarmRequest req = new GeckoSwarm.SwarmRequest();
        req.symbols = 'BTC';

        List<GeckoSwarm.SwarmResult> results = GeckoSwarm.executeSwarm(
            new List<GeckoSwarm.SwarmRequest>{ req }
        );
        Test.stopTest();

        GeckoSwarm.SwarmResult result = results[0];
        System.assertEquals(false, result.success, 'Should fail on API error');
        System.assert(result.errorMessage.contains('Price Fetcher failed'), 'Error message should indicate fetcher failure');
    }

    // ============================================
    // PRICE FETCHER AGENT TESTS
    // ============================================

    @IsTest
    static void testPriceFetcher_Success() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        GeckoSwarm.PriceFetcherResult result = GeckoSwarm.executePriceFetcher(
            new List<String>{ 'BTC', 'ETH' }
        );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Fetcher should succeed');
        System.assertEquals(2, result.prices.size(), 'Should have 2 prices');
        System.assertEquals(95000.50, result.prices.get('BTC'), 'BTC price should match mock');
        System.assertEquals(3200.75, result.prices.get('ETH'), 'ETH price should match mock');
    }

    @IsTest
    static void testPriceFetcher_EmptySymbols() {
        Test.startTest();
        GeckoSwarm.PriceFetcherResult result = GeckoSwarm.executePriceFetcher(
            new List<String>()
        );
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail with empty symbols');
        System.assert(result.errorMessage.contains('No valid symbols'), 'Should indicate no valid symbols');
    }

    // ============================================
    // ANALYZER AGENT TESTS
    // ============================================

    @IsTest
    static void testAnalyzer_WithPreviousPrices() {
        // Insert previous price records
        List<BTC_Price__c> previousPrices = new List<BTC_Price__c>{
            new BTC_Price__c(Symbol__c = 'BTC', Price__c = 90000, Signal__c = 'HOLD'),
            new BTC_Price__c(Symbol__c = 'ETH', Price__c = 3000, Signal__c = 'HOLD')
        };
        insert previousPrices;

        Map<String, Decimal> currentPrices = new Map<String, Decimal>{
            'BTC' => 95000.00,  // +5.56% -> STRONG BUY
            'ETH' => 2900.00   // -3.33% -> STRONG SELL
        };

        Test.startTest();
        GeckoSwarm.AnalyzerResult result = GeckoSwarm.executeAnalyzer(currentPrices);
        Test.stopTest();

        System.assertEquals(true, result.analysisComplete, 'Analysis should complete');
        System.assertEquals(2, result.signals.size(), 'Should have 2 signals');

        // Find BTC and ETH signals
        GeckoSwarm.AnalysisSignal btcSignal = null;
        GeckoSwarm.AnalysisSignal ethSignal = null;
        for (GeckoSwarm.AnalysisSignal sig : result.signals) {
            if (sig.symbol == 'BTC') btcSignal = sig;
            if (sig.symbol == 'ETH') ethSignal = sig;
        }

        System.assert(btcSignal != null, 'Should have BTC signal');
        System.assertEquals('STRONG BUY', btcSignal.recommendation, 'BTC should be STRONG BUY');
        System.assertEquals('BULLISH', btcSignal.momentum, 'BTC should be BULLISH');

        System.assert(ethSignal != null, 'Should have ETH signal');
        System.assertEquals('STRONG SELL', ethSignal.recommendation, 'ETH should be STRONG SELL');
        System.assertEquals('BEARISH', ethSignal.momentum, 'ETH should be BEARISH');
    }

    @IsTest
    static void testAnalyzer_NoPreviousPrices() {
        Map<String, Decimal> currentPrices = new Map<String, Decimal>{
            'BTC' => 95000.00
        };

        Test.startTest();
        GeckoSwarm.AnalyzerResult result = GeckoSwarm.executeAnalyzer(currentPrices);
        Test.stopTest();

        System.assertEquals(true, result.analysisComplete, 'Analysis should complete');
        GeckoSwarm.AnalysisSignal sig = result.signals[0];
        System.assertEquals(0, sig.changePercent, 'Change should be 0 with no previous price');
        System.assertEquals('HOLD', sig.recommendation, 'Should be HOLD with no change');
    }

    // ============================================
    // EXECUTOR AGENT TESTS
    // ============================================

    @IsTest
    static void testExecutor_Success() {
        List<GeckoSwarm.AnalysisSignal> signals = new List<GeckoSwarm.AnalysisSignal>();

        GeckoSwarm.AnalysisSignal sig1 = new GeckoSwarm.AnalysisSignal();
        sig1.symbol = 'BTC';
        sig1.currentPrice = 95000.00;
        sig1.changePercent = 5.0;
        sig1.recommendation = 'STRONG BUY';
        signals.add(sig1);

        GeckoSwarm.AnalysisSignal sig2 = new GeckoSwarm.AnalysisSignal();
        sig2.symbol = 'ETH';
        sig2.currentPrice = 3200.00;
        sig2.changePercent = -2.0;
        sig2.recommendation = 'STRONG SELL';
        signals.add(sig2);

        Test.startTest();
        GeckoSwarm.ExecutorResult result = GeckoSwarm.executeExecutor(signals);
        Test.stopTest();

        System.assertEquals(true, result.success, 'Executor should succeed');
        System.assertEquals(2, result.recordsCreated, 'Should create 2 records');

        // Verify records were created
        List<BTC_Price__c> createdRecords = [
            SELECT Symbol__c, Price__c, Signal__c
            FROM BTC_Price__c
            ORDER BY Symbol__c
        ];
        System.assertEquals(2, createdRecords.size(), 'Should have 2 records in DB');
    }

    @IsTest
    static void testExecutor_EmptySignals() {
        Test.startTest();
        GeckoSwarm.ExecutorResult result = GeckoSwarm.executeExecutor(
            new List<GeckoSwarm.AnalysisSignal>()
        );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Should succeed with empty signals');
        System.assertEquals(0, result.recordsCreated, 'Should create 0 records');
    }

    @IsTest
    static void testExecutor_NullSignals() {
        Test.startTest();
        GeckoSwarm.ExecutorResult result = GeckoSwarm.executeExecutor(null);
        Test.stopTest();

        System.assertEquals(true, result.success, 'Should succeed with null signals');
        System.assertEquals(0, result.recordsCreated, 'Should create 0 records');
    }

    // ============================================
    // DATA STRUCTURE TESTS
    // ============================================

    @IsTest
    static void testTradingSignalStructure() {
        GeckoSwarm.TradingSignal ts = new GeckoSwarm.TradingSignal();
        ts.symbol = 'BTC';
        ts.currentPrice = 95000.00;
        ts.previousPrice = 90000.00;
        ts.changePercent = 5.56;
        ts.signal = 'STRONG BUY';
        ts.confidence = 'HIGH';
        ts.momentum = 'BULLISH';

        System.assertEquals('BTC', ts.symbol);
        System.assertEquals(95000.00, ts.currentPrice);
        System.assertEquals('STRONG BUY', ts.signal);
        System.assertEquals('HIGH', ts.confidence);
        System.assertEquals('BULLISH', ts.momentum);
    }

    @IsTest
    static void testSwarmResultStructure() {
        GeckoSwarm.SwarmResult result = new GeckoSwarm.SwarmResult();
        result.executionId = 'TEST-123';
        result.success = true;
        result.summary = 'Test summary';
        result.startTime = System.now();
        result.endTime = System.now();
        result.tradingSignals = new List<GeckoSwarm.TradingSignal>();
        result.agentLogs = new List<String>{ 'Log 1', 'Log 2' };

        System.assertEquals('TEST-123', result.executionId);
        System.assertEquals(true, result.success);
        System.assertEquals(2, result.agentLogs.size());
    }
}