/**
 * @description       : Unit tests for GeckoBTCMomentum class
 * @author            : Troy Amyett
 * @group             : AgentForce Legend
 * @last modified on  : 01-11-2026
 **/
@IsTest
public class GeckoBTCMomentumTest {

    // Mock for successful CoinGecko responses
    private class MockCoinGeckoSuccess implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HTTPResponse res = new HTTPResponse();
            res.setStatusCode(200);

            // Check if it's a history request or simple price request
            if (req.getEndpoint().contains('/history')) {
                // Historical price response
                res.setBody('{"market_data":{"current_price":{"usd":90000.00}}}');
            } else {
                // Current price response
                res.setBody('{"bitcoin":{"usd":95000.00},"ethereum":{"usd":3200.00}}');
            }
            return res;
        }
    }

    @IsTest
    static void testCalculateMomentum_ValidInputs() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        Decimal momentum = GeckoBTCMomentum.calculateMomentum('BTC', 7);
        Test.stopTest();

        System.assertNotEquals(null, momentum, 'Momentum should not be null');
        // Current: 95000, Historical: 90000 => (95000-90000)/90000 * 100 = 5.56%
        System.assert(momentum > 0, 'Momentum should be positive when price increased');
    }

    @IsTest
    static void testCalculateMomentum_NullTicker() {
        try {
            GeckoBTCMomentum.calculateMomentum(null, 7);
            System.assert(false, 'Expected exception for null ticker');
        } catch (GeckoBTCMomentum.MomentumException e) {
            System.assert(e.getMessage().contains('Ticker is required'), 'Should get appropriate error message');
        }
    }

    @IsTest
    static void testCalculateMomentum_BlankTicker() {
        try {
            GeckoBTCMomentum.calculateMomentum('   ', 7);
            System.assert(false, 'Expected exception for blank ticker');
        } catch (GeckoBTCMomentum.MomentumException e) {
            System.assert(e.getMessage().contains('Ticker is required'), 'Should get appropriate error message');
        }
    }

    @IsTest
    static void testCalculateMomentum_InvalidTicker() {
        try {
            GeckoBTCMomentum.calculateMomentum('INVALIDCOIN', 7);
            System.assert(false, 'Expected exception for invalid ticker');
        } catch (GeckoBTCMomentum.MomentumException e) {
            System.assert(e.getMessage().contains('Unsupported or unknown ticker'), 'Should get appropriate error message');
        }
    }

    @IsTest
    static void testCalculateMomentum_NegativeDays() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        // Should default to 7 days when negative
        Decimal momentum = GeckoBTCMomentum.calculateMomentum('BTC', -1);
        Test.stopTest();

        System.assertNotEquals(null, momentum, 'Momentum should not be null with negative days (defaults to 7)');
    }

    @IsTest
    static void testCalculateMomentum_ZeroDays() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        // Should default to 7 days when zero
        Decimal momentum = GeckoBTCMomentum.calculateMomentum('ETH', 0);
        Test.stopTest();

        System.assertNotEquals(null, momentum, 'Momentum should not be null with zero days (defaults to 7)');
    }

    @IsTest
    static void testCalculateMomentumInvocable_Success() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        GeckoBTCMomentum.MomentumRequest req = new GeckoBTCMomentum.MomentumRequest();
        req.ticker = 'BTC';
        req.days = 7;

        Test.startTest();
        List<GeckoBTCMomentum.MomentumResult> results = GeckoBTCMomentum.calculateMomentumInvocable(
            new List<GeckoBTCMomentum.MomentumRequest>{ req }
        );
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Should return one result');
        System.assertEquals(true, results[0].success, 'Should succeed');
        System.assertEquals('BTC', results[0].ticker, 'Ticker should be BTC');
        System.assertNotEquals(null, results[0].momentum, 'Momentum should not be null');
    }

    @IsTest
    static void testCalculateMomentumInvocable_DefaultValues() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        GeckoBTCMomentum.MomentumRequest req = new GeckoBTCMomentum.MomentumRequest();
        // Leave ticker and days null to test defaults

        Test.startTest();
        List<GeckoBTCMomentum.MomentumResult> results = GeckoBTCMomentum.calculateMomentumInvocable(
            new List<GeckoBTCMomentum.MomentumRequest>{ req }
        );
        Test.stopTest();

        System.assertEquals(true, results[0].success, 'Should succeed with defaults');
        System.assertEquals('BTC', results[0].ticker, 'Should default to BTC');
        System.assertEquals(7, results[0].days, 'Should default to 7 days');
    }

    @IsTest
    static void testCalculateMomentumInvocable_InvalidTicker() {
        GeckoBTCMomentum.MomentumRequest req = new GeckoBTCMomentum.MomentumRequest();
        req.ticker = 'FAKECOIN';
        req.days = 7;

        Test.startTest();
        List<GeckoBTCMomentum.MomentumResult> results = GeckoBTCMomentum.calculateMomentumInvocable(
            new List<GeckoBTCMomentum.MomentumRequest>{ req }
        );
        Test.stopTest();

        System.assertEquals(false, results[0].success, 'Should fail for invalid ticker');
        System.assertNotEquals(null, results[0].errorMessage, 'Should have error message');
    }

    @IsTest
    static void testMomentumRequestClass() {
        GeckoBTCMomentum.MomentumRequest req = new GeckoBTCMomentum.MomentumRequest();
        req.ticker = 'ETH';
        req.days = 14;

        System.assertEquals('ETH', req.ticker);
        System.assertEquals(14, req.days);
    }

    @IsTest
    static void testMomentumResultClass() {
        GeckoBTCMomentum.MomentumResult res = new GeckoBTCMomentum.MomentumResult();
        res.success = true;
        res.ticker = 'SOL';
        res.days = 7;
        res.momentum = 12.5;
        res.errorMessage = null;

        System.assertEquals(true, res.success);
        System.assertEquals('SOL', res.ticker);
        System.assertEquals(7, res.days);
        System.assertEquals(12.5, res.momentum);
    }
}