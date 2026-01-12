/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 11-06-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class CryptoPriceCallout {
    private static final Map<String, String> SYMBOL_TO_ID_MAP = new Map<String, String>();
    static {
        SYMBOL_TO_ID_MAP.put('BTC', 'bitcoin');
        SYMBOL_TO_ID_MAP.put('ETH', 'ethereum');
        SYMBOL_TO_ID_MAP.put('ADA', 'cardano');
        SYMBOL_TO_ID_MAP.put('BNB', 'binancecoin');
        SYMBOL_TO_ID_MAP.put('SOL', 'solana');
        SYMBOL_TO_ID_MAP.put('XRP', 'ripple');
        SYMBOL_TO_ID_MAP.put('DOGE', 'dogecoin');
        SYMBOL_TO_ID_MAP.put('DOT', 'polkadot');
        SYMBOL_TO_ID_MAP.put('LINK', 'chainlink');
        SYMBOL_TO_ID_MAP.put('LTC', 'litecoin');
    }

    public class PriceInput {
        @InvocableVariable
        public String cryptoSymbol;
    }

    public class PriceResult {
        @InvocableVariable
        public String cryptoName;
        @InvocableVariable
        public Decimal usdPrice;
        @InvocableVariable
        public String errorMessage;
    }

    @InvocableMethod
    public static List<PriceResult> getCryptoPrice(List<PriceInput> inputs) {
        List<PriceResult> results = new List<PriceResult>();

        // Bulk-safe: handle every input (even if Flow sends one)
        if (inputs == null || inputs.isEmpty()) {
            results.add(createErrorResult('No inputs provided.'));
            return results;
        }

        for (PriceInput input : inputs) {
            PriceResult r = new PriceResult();

            if (input == null || String.isBlank(input.cryptoSymbol)) {
                r = createErrorResult('Symbol is blank.');
            } else {
                String sym = input.cryptoSymbol.trim().toUpperCase();
                String id  = SYMBOL_TO_ID_MAP.get(sym);

                if (id == null) {
                    r = createErrorResult('Unsupported symbol: ' + sym);
                } else {
                    r = fetchPriceForId(id, sym);
                }
            }
            results.add(r);
        }

        return results;
    }

    // Helper to build error results safe for Flow outputs
    private static PriceResult createErrorResult(String msg) {
        PriceResult pr = new PriceResult();
        pr.cryptoName = null;
        pr.usdPrice = null;
        pr.errorMessage = msg;
        return pr;
    }

    // Performs the HTTP callout to CoinGecko and parses the USD price
    @TestVisible
    private static PriceResult fetchPriceForId(String geckoId, String symbol) {
        PriceResult pr = new PriceResult();
        pr.cryptoName = symbol;
        pr.errorMessage = null;

        try {
            Http http = new Http();
            HttpRequest req = new HttpRequest();
            // Sample endpoint: https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
            // Note: '&' is just for XML contexts; use '&' in Apex string.
            String url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + EncodingUtil.urlEncode(geckoId, 'UTF-8') +
                         '&vs_currencies=usd';
            req.setEndpoint(url);
            req.setMethod('GET');
            req.setTimeout(10000);

            HttpResponse res = http.send(req);
            if (res.getStatusCode() != 200) {
                return createErrorResult('HTTP ' + res.getStatusCode() + ': ' + res.getStatus());
            }

            // Expected body format: {"bitcoin":{"usd":103389.00}}
            Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            Object coinNode = root != null ? root.get(geckoId) : null;
            if (coinNode == null || !(coinNode instanceof Map<String, Object>)) {
                return createErrorResult('Malformed response');
            }
            Map<String, Object> coin = (Map<String, Object>) coinNode;
            Object usdVal = coin.get('usd');
            if (usdVal == null) {
                return createErrorResult('USD price not found');
            }

            // Convert to Decimal (handles Integer/Long/Double representations)
            Decimal price;
            if (usdVal instanceof Decimal) {
                price = (Decimal) usdVal;
            } else if (usdVal instanceof Integer) {
                price = Decimal.valueOf((Integer) usdVal);
            } else if (usdVal instanceof Long) {
                price = Decimal.valueOf((Long) usdVal);
            } else if (usdVal instanceof Double) {
                price = Decimal.valueOf((Double) usdVal);
            } else if (usdVal instanceof String) {
                price = Decimal.valueOf((String) usdVal);
            } else {
                return createErrorResult('Unrecognized usd type: ' + String.valueOf(usdVal));
            }

            pr.usdPrice = price;
            return pr;
        } catch (Exception e) {
            return createErrorResult('Exception: ' + e.getMessage());
        }
    }
}