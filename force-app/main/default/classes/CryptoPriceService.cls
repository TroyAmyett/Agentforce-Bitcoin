/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 11-06-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public without sharing class CryptoPriceService {
    /**
     * REQUIREMENTS
     * - Takes a crypto ticker (e.g., BTC, ETH) as input
     * - Calls the CoinGecko API (free, no key needed)
     * - Returns the current USD price
     * - Handles errors gracefully
     * - Works in Lightning (Aura/LWC), Flow, REST, or Process Builder
     */

    public class CalloutException extends Exception {}

    // Public API: Single ticker -> USD price
    public static Decimal getUsdPrice(String ticker) {
        if (String.isBlank(ticker)) {
            throw new CalloutException('Ticker is required');
        }
        String norm = ticker.trim().toUpperCase();

        String geckoId = resolveGeckoId(norm);
        if (String.isBlank(geckoId)) {
            throw new CalloutException('Unsupported or unknown ticker: ' + norm);
        }

        try {
            // Batch path can handle one id as well
            Map<String, Decimal> mapPrices = getUsdPrices(new List<String>{ norm });
            if (mapPrices.containsKey(norm)) {
                return mapPrices.get(norm);
            }
            throw new CalloutException('USD price not found for ' + norm);
        } catch (CalloutException e) {
            throw e;
        } catch (Exception e) {
            throw new CalloutException('Failed to retrieve price for ' + norm + ': ' + e.getMessage());
        }
    }

    // Public API: Multiple tickers -> Map<TICKER, USD price>
    public static Map<String, Decimal> getUsdPrices(List<String> tickers) {
        Map<String, Decimal> results = new Map<String, Decimal>();
        if (tickers == null || tickers.isEmpty()) {
            return results;
        }

        // Normalize & de-duplicate
        Set<String> uniqueTickers = new Set<String>();
        for (String t : tickers) {
            if (!String.isBlank(t)) {
                uniqueTickers.add(t.trim().toUpperCase());
            }
        }
        if (uniqueTickers.isEmpty()) {
            return results;
        }

        // Resolve to CoinGecko IDs
        Map<String, String> tickerToId = new Map<String, String>();
        for (String t : uniqueTickers) {
            String idVal = resolveGeckoId(t);
            if (!String.isBlank(idVal)) {
                tickerToId.put(t, idVal);
            } else {
                System.debug(LoggingLevel.WARN, 'Unknown ticker for CoinGecko: ' + t);
            }
        }
        if (tickerToId.isEmpty()) {
            // none resolvable
            return results;
        }

        // Build ids parameter (comma separated)
        Set<String> geckoIds = new Set<String>(tickerToId.values());
        HttpResponse res = doGeckoRequest(geckoIds);
        if (res == null) {
            System.debug(LoggingLevel.WARN, 'No HTTP response from CoinGecko');
            return results;
        }
        if (res.getStatusCode() != 200) {
            // Graceful error: log and return partial/empty results
            System.debug(LoggingLevel.WARN, 'CoinGecko HTTP ' + res.getStatusCode() + ' - ' + res.getStatus());
            return results;
        }

        // Parse body
        String body = res.getBody();
        if (String.isBlank(body)) {
            System.debug(LoggingLevel.WARN, 'CoinGecko returned empty body');
            return results;
        }

        Map<String, Decimal> idToUsd = parseSimplePrice(body);
        // Map back to requested tickers
        for (String t : tickerToId.keySet()) {
            String gid = tickerToId.get(t);
            if (idToUsd.containsKey(gid)) {
                results.put(t, idToUsd.get(gid));
            }
        }
        return results;
    }

    // Lightweight resolver for common tickers -> CoinGecko ids.
    // Extend this map as needed. Optionally could be populated from Custom Metadata in future.
    private static Map<String, String> TICKER_TO_GECKO_ID = new Map<String, String>{
        'BTC' => 'bitcoin',
        'ETH' => 'ethereum',
        'ADA' => 'cardano',
        'SOL' => 'solana',
        'DOGE' => 'dogecoin',
        'MATIC' => 'matic-network',
        'XRP' => 'ripple',
        'DOT' => 'polkadot'
    };

    private static String resolveGeckoId(String ticker) {
        if (String.isBlank(ticker)) return null;
        String t = ticker.trim().toUpperCase();
        if (TICKER_TO_GECKO_ID.containsKey(t)) {
            return TICKER_TO_GECKO_ID.get(t);
        }
        return null;
    }

    // Perform a single batched request to CoinGecko Simple Price API
    // GET https://api.coingecko.com/api/v3/simple/price?ids={commaIds}&vs_currencies=usd
    private static HttpResponse doGeckoRequest(Set<String> geckoIds) {
        if (geckoIds == null || geckoIds.isEmpty()) return null;

        String idsParam = String.join(new List<String>(geckoIds), ',');
        // If a Named Credential is desired later, we could switch endpoint base easily.
        String endpoint = 'https://api.coingecko.com/api/v3/simple/price?ids='
            + EncodingUtil.urlEncode(idsParam, 'UTF-8')
            + '&vs_currencies=usd';

        HttpRequest req = new HttpRequest();
        req.setMethod('GET');
        req.setEndpoint(endpoint);
        req.setTimeout(10000);

        Http http = new Http();
        try {
            return http.send(req);
        } catch (System.CalloutException ex) {
            System.debug(LoggingLevel.WARN, 'HTTP callout failed: ' + ex.getMessage());
            return null;
        }
    }

    // Parse {"bitcoin":{"usd":65000.12}, "ethereum":{"usd":3200.01}}
    // Returns Map<geckoId, usdPrice>
    private static Map<String, Decimal> parseSimplePrice(String body) {
        Map<String, Decimal> out = new Map<String, Decimal>();
        try {
            Object root = JSON.deserializeUntyped(body);
            if (!(root instanceof Map<String, Object>)) {
                System.debug(LoggingLevel.WARN, 'Unexpected JSON root type');
                return out;
            }
            Map<String, Object> mRoot = (Map<String, Object>)root;
            for (String gid : mRoot.keySet()) {
                Object v = mRoot.get(gid);
                if (v instanceof Map<String, Object>) {
                    Map<String, Object> inner = (Map<String, Object>)v;
                    if (inner.containsKey('usd')) {
                        Object usd = inner.get('usd');
                        if (usd != null) {
                            // CoinGecko returns number; Apex will see as Decimal/Double depending on parser
                            Decimal d;
                            try {
                                d = (Decimal)usd;
                            } catch (Exception castEx) {
                                d = Decimal.valueOf(String.valueOf(usd));
                            }
                            out.put(gid, d);
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to parse CoinGecko response: ' + e.getMessage());
        }
        return out;
    }

    // Optional: Aura/LWC-friendly wrapper returning a simple DTO and enabling cacheable usage if placed in a separate @AuraEnabled method
    public class PriceResult {
        @AuraEnabled public String ticker;
        @AuraEnabled public Decimal usd;
        @AuraEnabled public String error;
    }

    @AuraEnabled(cacheable=true)
    public static PriceResult getUsdPriceAura(String ticker) {
        PriceResult pr = new PriceResult();
        pr.ticker = String.isBlank(ticker) ? null : ticker.trim().toUpperCase();
        try {
            pr.usd = getUsdPrice(ticker);
        } catch (CalloutException e) {
            pr.error = e.getMessage();
        }
        return pr;
    }
}
