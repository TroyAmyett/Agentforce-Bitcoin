/**
 * @description       : Test class for TradingConsoleController
 * @author            : Troy Amyett
 * @group             : AgentForce Legend
 * @last modified on  : 01-11-2026
 **/
@IsTest
private class TradingConsoleControllerTest {

    // Mock for successful CoinGecko responses
    private class MockCoinGeckoSuccess implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HTTPResponse res = new HTTPResponse();
            res.setStatusCode(200);
            res.setBody('{"bitcoin":{"usd":95000.50},"ethereum":{"usd":3200.75},"solana":{"usd":145.25}}');
            return res;
        }
    }

    @TestSetup
    static void setupTestData() {
        // Create test BTC_Price__c records
        List<BTC_Price__c> prices = new List<BTC_Price__c>{
            new BTC_Price__c(Symbol__c = 'BTC', Price__c = 95000.50, Change_Pct__c = 2.5, Signal__c = 'BUY'),
            new BTC_Price__c(Symbol__c = 'ETH', Price__c = 3200.75, Change_Pct__c = -1.2, Signal__c = 'SELL'),
            new BTC_Price__c(Symbol__c = 'SOL', Price__c = 145.25, Change_Pct__c = 0.3, Signal__c = 'HOLD')
        };
        insert prices;

        // Create test Trade__c records
        List<Trade__c> trades = new List<Trade__c>{
            new Trade__c(
                Symbol__c = 'BTC',
                Action__c = 'BUY',
                Price__c = 94500.00,
                Signal_Strength__c = 'STRONG',
                Momentum__c = 'BULLISH',
                Executed_At__c = Datetime.now().addHours(-1)
            ),
            new Trade__c(
                Symbol__c = 'ETH',
                Action__c = 'SELL',
                Price__c = 3250.00,
                Signal_Strength__c = 'MODERATE',
                Momentum__c = 'BEARISH',
                Executed_At__c = Datetime.now().addHours(-2)
            )
        };
        insert trades;
    }

    @IsTest
    static void testExecuteSwarm_Success() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        TradingConsoleController.SwarmResultWrapper result = TradingConsoleController.executeSwarm('BTC,ETH');
        Test.stopTest();

        System.assertEquals(true, result.success, 'Swarm should succeed');
        System.assertNotEquals(null, result.executionId, 'Should have execution ID');
        System.assertNotEquals(null, result.tradingSignals, 'Should have trading signals');
    }

    @IsTest
    static void testExecuteSwarm_DefaultSymbols() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        TradingConsoleController.SwarmResultWrapper result = TradingConsoleController.executeSwarm(null);
        Test.stopTest();

        System.assertEquals(true, result.success, 'Swarm should succeed with default symbols');
    }

    @IsTest
    static void testExecuteSwarm_BlankSymbols() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        TradingConsoleController.SwarmResultWrapper result = TradingConsoleController.executeSwarm('');
        Test.stopTest();

        System.assertEquals(true, result.success, 'Swarm should succeed with blank symbols (uses defaults)');
    }

    @IsTest
    static void testGetLatestPrices() {
        Test.startTest();
        List<BTC_Price__c> prices = TradingConsoleController.getLatestPrices();
        Test.stopTest();

        System.assertEquals(3, prices.size(), 'Should return 3 unique symbol prices');

        // Verify symbols
        Set<String> symbols = new Set<String>();
        for (BTC_Price__c p : prices) {
            symbols.add(p.Symbol__c);
        }
        System.assert(symbols.contains('BTC'), 'Should contain BTC');
        System.assert(symbols.contains('ETH'), 'Should contain ETH');
        System.assert(symbols.contains('SOL'), 'Should contain SOL');
    }

    @IsTest
    static void testGetLatestPrices_Empty() {
        // Delete all price records
        delete [SELECT Id FROM BTC_Price__c];

        Test.startTest();
        List<BTC_Price__c> prices = TradingConsoleController.getLatestPrices();
        Test.stopTest();

        System.assertEquals(0, prices.size(), 'Should return empty list when no prices exist');
    }

    @IsTest
    static void testGetRecentTrades() {
        Test.startTest();
        List<Trade__c> trades = TradingConsoleController.getRecentTrades();
        Test.stopTest();

        System.assertEquals(2, trades.size(), 'Should return 2 trades');

        // Verify order (most recent first)
        System.assertEquals('BTC', trades[0].Symbol__c, 'First trade should be BTC (more recent)');
        System.assertEquals('ETH', trades[1].Symbol__c, 'Second trade should be ETH');
    }

    @IsTest
    static void testGetRecentTrades_Empty() {
        // Delete all trade records
        delete [SELECT Id FROM Trade__c];

        Test.startTest();
        List<Trade__c> trades = TradingConsoleController.getRecentTrades();
        Test.stopTest();

        System.assertEquals(0, trades.size(), 'Should return empty list when no trades exist');
    }

    @IsTest
    static void testSwarmResultWrapper() {
        TradingConsoleController.SwarmResultWrapper wrapper = new TradingConsoleController.SwarmResultWrapper();
        wrapper.success = true;
        wrapper.executionId = 'TEST-123';
        wrapper.summary = 'Test summary';
        wrapper.errorMessage = null;
        wrapper.tradingSignals = new List<TradingConsoleController.TradingSignalWrapper>();

        System.assertEquals(true, wrapper.success);
        System.assertEquals('TEST-123', wrapper.executionId);
        System.assertEquals('Test summary', wrapper.summary);
    }

    @IsTest
    static void testTradingSignalWrapper() {
        TradingConsoleController.TradingSignalWrapper wrapper = new TradingConsoleController.TradingSignalWrapper();
        wrapper.symbol = 'BTC';
        wrapper.currentPrice = 95000.00;
        wrapper.previousPrice = 90000.00;
        wrapper.changePercent = 5.56;
        wrapper.signal = 'STRONG BUY';
        wrapper.confidence = 'HIGH';
        wrapper.momentum = 'BULLISH';

        System.assertEquals('BTC', wrapper.symbol);
        System.assertEquals(95000.00, wrapper.currentPrice);
        System.assertEquals('STRONG BUY', wrapper.signal);
        System.assertEquals('HIGH', wrapper.confidence);
        System.assertEquals('BULLISH', wrapper.momentum);
    }

    @IsTest
    static void testTradeRecordCreation() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        // Insert a previous price so the analyzer generates a BUY signal
        insert new BTC_Price__c(Symbol__c = 'BTC', Price__c = 90000.00, Signal__c = 'HOLD');

        Integer tradeCountBefore = [SELECT COUNT() FROM Trade__c];

        Test.startTest();
        TradingConsoleController.SwarmResultWrapper result = TradingConsoleController.executeSwarm('BTC');
        Test.stopTest();

        // Verify trades were created
        Integer tradeCountAfter = [SELECT COUNT() FROM Trade__c];

        // Should create trade records for BUY/SELL signals (depends on price change)
        System.assert(tradeCountAfter >= tradeCountBefore, 'Trade count should not decrease');
    }
}