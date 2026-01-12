/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 11-08-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
@IsTest
private class CryptoPriceAgentTest {
    
    @IsTest
    static void testGetPrice_Simple() {
        // Mock response
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoResponse('{"bitcoin":{"usd":68427.31}}', 200));
        
        Test.startTest();
        List<CryptoPriceAgent.Result> results = CryptoPriceAgent.getPrice(
            new List<CryptoPriceAgent.Request>{ new CryptoPriceAgent.Request() }
        );
        Test.stopTest();
        
        System.assertNotEquals(null, results);
    }
    
    public class MockCoinGeckoResponse implements HttpCalloutMock {
        String body;
        Integer statusCode;
        
        public MockCoinGeckoResponse(String body, Integer statusCode) {
            this.body = body;
            this.statusCode = statusCode;
        }
        
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setBody(this.body);
            res.setStatusCode(this.statusCode);
            res.setHeader('Content-Type', 'application/json');
            return res;
        }
    }
}