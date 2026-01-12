/**
 * This class contains unit tests for validating the behavior of Apex classes
 * and triggers.
 *
 * Unit tests are class methods that verify whether a particular piece
 * of code is working properly. Unit test methods take no arguments,
 * commit no data to the database, and are flagged with the testMethod
 * keyword in the method definition.
 *
 * All test methods in an org are executed whenever Apex code is deployed
 * to a production org to confirm correctness, ensure code
 * coverage, and prevent regressions. All Apex classes are
 * required to have at least 75% code coverage in order to be deployed
 * to a production org. In addition, all triggers must have some code coverage.
 * 
 * The @isTest class annotation indicates this class only contains test
 * methods. Classes defined with the @isTest annotation do not count against
 * the org size limit for all Apex scripts.
 *
 * See the Apex Language Reference for more information about Testing and Code Coverage.
 */
@IsTest
private class CryptoPriceCalloutTest {
    
    @IsTest
    static void testBTC() {
        // Mock the callout (no real HTTP)
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoResponse());
        
        CryptoPriceCallout.PriceInput input = new CryptoPriceCallout.PriceInput();
        input.cryptoSymbol = 'BTC';
        
        List<CryptoPriceCallout.PriceResult> results = 
            CryptoPriceCallout.getCryptoPrice(new List<CryptoPriceCallout.PriceInput>{input});
        
        System.assertEquals('BTC', results[0].cryptoName);
        System.assert(results[0].usdPrice > 0, 'Price should be positive');
    }
    
    // Mock response for CoinGecko
    private class MockCoinGeckoResponse implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HTTPResponse res = new HTTPResponse();
            res.setStatusCode(200);
            res.setBody('{"bitcoin":{"usd":103389.00}}');
            return res;
        }
    }
}