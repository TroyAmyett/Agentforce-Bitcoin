/**
 * Simplified unit test for CryptoPriceAgent class
 */
@isTest
private class CryptoPriceAgentSimpleTest {
    
    @isTest
    static void testGetPrice() {
        // Set up mock callout response
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoResponse());
        
        // Create test request
        List<CryptoPriceAgent.Request> requests = new List<CryptoPriceAgent.Request>();
        requests.add(new CryptoPriceAgent.Request());
        
        // Execute the method
        List<CryptoPriceAgent.Result> results = CryptoPriceAgent.getPrice(requests);
        
        // Basic verification
        System.assertNotEquals(null, results, 'Results should not be null');
        System.assert(results.size() > 0, 'Should return at least one result');
        
        CryptoPriceAgent.Result result = results[0];
        System.assertNotEquals(null, result.price, 'Price should not be null');
        System.assert(result.price > 0, 'Price should be positive');
    }
    
    // Mock response for CoinGecko
    private class MockCoinGeckoResponse implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HTTPResponse res = new HTTPResponse();
            res.setStatusCode(200);
            // Return a realistic Bitcoin price response
            res.setBody('{"bitcoin":{"usd":103389.00}}');
            return res;
        }
    }
}
