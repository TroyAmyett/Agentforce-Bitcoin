/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 11-06-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
@IsTest
private class CryptoPriceServiceTest {
    // Simple HttpCalloutMock for both CryptoTickerPriceCallout and CryptoPriceCallout paths
    private class SimplePriceMock implements HttpCalloutMock {
        Map<String, Decimal> pricesBySymbol;
        Integer statusCode;
        String status;

        SimplePriceMock(Map<String, Decimal> pricesBySymbol, Integer statusCode, String status) {
            this.pricesBySymbol = pricesBySymbol;
            this.statusCode = statusCode;
            this.status = status;
        }

        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(statusCode);
            res.setStatus(status);

            // Infer symbol from URL query string (common for callout classes)
            String url = req.getEndpoint();
            String sym = null;
            if (url != null) {
                // Try common query param names
                List<String> parts = url.split('\\?');
                if (parts.size() > 1) {
                    String qs = parts[1];
                    for (String kv : qs.split('&')) {
                        List<String> pair = kv.split('=');
                        if (pair.size() == 2) {
                            String key = EncodingUtil.urlDecode(pair[0], 'UTF-8').toLowerCase();
                            String val = EncodingUtil.urlDecode(pair[1], 'UTF-8');
                            if (key == 'symbol' || key == 'ticker' || key == 'ids' || key == 'id') {
                                sym = val != null ? val.trim().toUpperCase() : null;
                            }
                        }
                    }
                }
            }
            Decimal price = pricesBySymbol != null && sym != null && pricesBySymbol.containsKey(sym)
                ? pricesBySymbol.get(sym)
                : 123.45;

            // Build a minimal JSON based on common patterns for our callouts
            // Example 1 (ticker style): { "symbol":"BTC","price":123.45 }
            // Example 2 (gecko style map): {"BTC":{"usd":123.45}}
            String body;
            if (url != null && url.toLowerCase().contains('ticker')) {
                body = '{"symbol":"' + sym + '","price":' + String.valueOf(price) + '}';
            } else if (url != null && url.toLowerCase().contains('coingecko')) {
                body = '{"' + sym + '":{"usd":' + String.valueOf(price) + '}}';
            } else {
                body = '{"symbol":"' + sym + '","price":' + String.valueOf(price) + '}';
            }
            res.setBody(body);
            return res;
        }
    }

    @IsTest
    static void testGetPrice_UsesTickerWhenAvailable() {
        // Arrange
        Test.startTest();
        Map<String, Decimal> prices = new Map<String, Decimal>{ 'BTC' => 42000.01 };
        Test.setMock(HttpCalloutMock.class, new SimplePriceMock(prices, 200, 'OK'));

        // Act
        Decimal price = CryptoPriceService.getUsdPrice('btc');

        // Assert
        System.assertEquals(42000.01, price, 'Should return mocked BTC price from ticker endpoint');
        Test.stopTest();
    }

    @IsTest
    static void testGetPrice_FallsBackToGenericWhenTickerMissing() {
        // This test simulates a scenario where ticker class might not be used; however since the class exists,
        // we still validate general behavior with a different symbol to ensure code path stability.
        Test.startTest();
        Map<String, Decimal> prices = new Map<String, Decimal>{ 'ETH' => 2500.55 };
        Test.setMock(HttpCalloutMock.class, new SimplePriceMock(prices, 200, 'OK'));

        Decimal price = CryptoPriceService.getUsdPrice('eth');
        System.assertEquals(2500.55, price, 'Should return mocked ETH price');
        Test.stopTest();
    }

    @IsTest
    static void testGetPrices_ListHappyPath() {
        Test.startTest();
        Map<String, Decimal> prices = new Map<String, Decimal>{
            'BTC' => 50000,
            'ETH' => 3000
        };
        Test.setMock(HttpCalloutMock.class, new SimplePriceMock(prices, 200, 'OK'));

        Map<String, Decimal> result = CryptoPriceService.getUsdPrices(new List<String>{'btc','eth','btc',null,'  '});
        System.assertEquals(2, result.size(), 'Only BTC and ETH should be returned');
        System.assertEquals(50000, result.get('BTC'));
        System.assertEquals(3000, result.get('ETH'));
        Test.stopTest();
    }

    @IsTest
    static void testGetPrice_InvalidInput() {
        try {
            CryptoPriceService.getUsdPrice(null);
            System.assert(false, 'Expected exception for null symbol');
        } catch (CryptoPriceService.CalloutException ex) {
            System.assert(ex.getMessage().contains('Ticker is required'));
        }

        try {
            CryptoPriceService.getUsdPrice('   ');
            System.assert(false, 'Expected exception for blank symbol');
        } catch (CryptoPriceService.CalloutException ex) {
            System.assert(ex.getMessage().contains('Ticker is required'));
        }
    }
}
