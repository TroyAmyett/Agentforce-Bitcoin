/**
 * @description       : Calculates cryptocurrency momentum (price change over time)
 * @author            : Troy Amyett
 * @group             : AgentForce Legend
 * @last modified on  : 01-11-2026
 **/
public without sharing class GeckoBTCMomentum {

    // Custom exception for momentum calculation errors
    public class MomentumException extends Exception {}

    // Ticker to CoinGecko ID mapping
    private static final Map<String, String> TICKER_TO_GECKO_ID = new Map<String, String>{
        'BTC' => 'bitcoin',
        'ETH' => 'ethereum',
        'ADA' => 'cardano',
        'SOL' => 'solana',
        'DOGE' => 'dogecoin',
        'MATIC' => 'matic-network',
        'XRP' => 'ripple',
        'DOT' => 'polkadot',
        'BNB' => 'binancecoin',
        'LINK' => 'chainlink',
        'LTC' => 'litecoin'
    };

    // ============================================
    // INVOCABLE METHOD FOR FLOWS/AGENTFORCE
    // ============================================

    @InvocableMethod(label='Calculate Crypto Momentum' description='Calculates price momentum for a cryptocurrency over a specified number of days')
    public static List<MomentumResult> calculateMomentumInvocable(List<MomentumRequest> requests) {
        List<MomentumResult> results = new List<MomentumResult>();

        for (MomentumRequest req : requests) {
            MomentumResult res = new MomentumResult();
            try {
                String ticker = String.isBlank(req.ticker) ? 'BTC' : req.ticker;
                Integer days = (req.days == null || req.days <= 0) ? 7 : req.days;

                res.momentum = calculateMomentum(ticker, days);
                res.success = true;
                res.ticker = ticker.toUpperCase();
                res.days = days;
            } catch (Exception e) {
                res.success = false;
                res.errorMessage = e.getMessage();
            }
            results.add(res);
        }

        return results;
    }

    // Request class for invocable method
    public class MomentumRequest {
        @InvocableVariable(label='Ticker' description='Cryptocurrency ticker (e.g., BTC, ETH). Defaults to BTC.')
        public String ticker;

        @InvocableVariable(label='Days' description='Number of days for momentum calculation. Defaults to 7.')
        public Integer days;
    }

    // Result class for invocable method
    public class MomentumResult {
        @InvocableVariable public Boolean success;
        @InvocableVariable public String ticker;
        @InvocableVariable public Integer days;
        @InvocableVariable public Decimal momentum;
        @InvocableVariable public String errorMessage;
    }

    // ============================================
    // CORE MOMENTUM CALCULATION
    // ============================================

    /**
     * @description Calculates momentum for a given cryptocurrency over a specified period
     * @param ticker The cryptocurrency ticker (e.g., BTC, ETH)
     * @param days The number of days to calculate momentum over (default 7)
     * @return The momentum percentage change
     */
    public static Decimal calculateMomentum(String ticker, Integer days) {
        if (String.isBlank(ticker)) {
            throw new MomentumException('Ticker is required');
        }
        if (days == null || days <= 0) {
            days = 7;
        }

        String normalizedTicker = ticker.trim().toUpperCase();
        String geckoId = resolveGeckoId(normalizedTicker);
        if (String.isBlank(geckoId)) {
            throw new MomentumException('Unsupported or unknown ticker: ' + normalizedTicker);
        }

        try {
            // Get current price
            Decimal currentPrice = getCurrentPrice(geckoId);

            // Get historical price (days ago)
            Decimal historicalPrice = getHistoricalPrice(geckoId, days);

            // Calculate momentum percentage
            if (historicalPrice == null || historicalPrice == 0) {
                return 0; // Avoid division by zero
            }

            Decimal momentum = ((currentPrice - historicalPrice) / historicalPrice) * 100;
            return momentum.setScale(2, RoundingMode.HALF_UP);
        } catch (MomentumException e) {
            throw e;
        } catch (Exception e) {
            throw new MomentumException('Failed to calculate momentum for ' + normalizedTicker + ': ' + e.getMessage());
        }
    }

    // ============================================
    // PRICE FETCHING METHODS
    // ============================================

    /**
     * @description Gets the current price for a cryptocurrency
     */
    private static Decimal getCurrentPrice(String geckoId) {
        Set<String> geckoIds = new Set<String>{geckoId};
        HttpResponse res = doGeckoRequest(geckoIds);

        if (res == null || res.getStatusCode() != 200) {
            throw new MomentumException('Failed to get current price from CoinGecko');
        }

        Map<String, Decimal> prices = parseSimplePrice(res.getBody());
        if (prices.containsKey(geckoId)) {
            return prices.get(geckoId);
        }
        throw new MomentumException('USD price not found for ' + geckoId);
    }

    /**
     * @description Gets the historical price for a cryptocurrency from N days ago
     * Uses CoinGecko's history endpoint with date parameter (format: dd-mm-yyyy)
     */
    private static Decimal getHistoricalPrice(String geckoId, Integer days) {
        try {
            String dateStr = getDateNDaysAgo(days);
            String endpoint = 'callout:CoinGecko/api/v3/coins/' + geckoId + '/history?date=' + dateStr + '&localization=false';

            HttpRequest req = new HttpRequest();
            req.setMethod('GET');
            req.setEndpoint(endpoint);
            req.setTimeout(30000);

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() != 200) {
                // Fall back to current price if historical not available
                System.debug(LoggingLevel.WARN, 'Historical price not available, using current price');
                return getCurrentPrice(geckoId);
            }

            // Parse the historical response
            Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

            if (jsonResponse.containsKey('market_data')) {
                Map<String, Object> marketData = (Map<String, Object>) jsonResponse.get('market_data');
                if (marketData.containsKey('current_price')) {
                    Map<String, Object> currentPriceData = (Map<String, Object>) marketData.get('current_price');
                    if (currentPriceData.containsKey('usd')) {
                        Object usdValue = currentPriceData.get('usd');
                        if (usdValue instanceof Decimal) {
                            return (Decimal) usdValue;
                        }
                        return Decimal.valueOf(String.valueOf(usdValue));
                    }
                }
            }

            // Fall back to current price if parsing fails
            return getCurrentPrice(geckoId);

        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Historical price fetch failed: ' + e.getMessage());
            // Fall back to stored historical price from BTC_Price__c if available
            return getStoredHistoricalPrice(geckoId, days);
        }
    }

    /**
     * @description Gets historical price from stored BTC_Price__c records
     */
    private static Decimal getStoredHistoricalPrice(String geckoId, Integer days) {
        // Map geckoId back to ticker
        String ticker = null;
        for (String t : TICKER_TO_GECKO_ID.keySet()) {
            if (TICKER_TO_GECKO_ID.get(t) == geckoId) {
                ticker = t;
                break;
            }
        }

        if (ticker == null) {
            return null;
        }

        try {
            Datetime targetDate = Datetime.now().addDays(-days);
            List<BTC_Price__c> historicalRecords = [
                SELECT Price__c
                FROM BTC_Price__c
                WHERE Symbol__c = :ticker
                AND CreatedDate <= :targetDate
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];

            if (!historicalRecords.isEmpty()) {
                return historicalRecords[0].Price__c;
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to get stored historical price: ' + e.getMessage());
        }

        return null;
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * @description Helper to get a date N days ago in dd-mm-yyyy format (CoinGecko format)
     */
    private static String getDateNDaysAgo(Integer days) {
        if (days == null) days = 7;
        Date targetDate = Date.today().addDays(-days);
        // CoinGecko expects dd-mm-yyyy format
        return String.valueOf(targetDate.day()).leftPad(2, '0') + '-' +
               String.valueOf(targetDate.month()).leftPad(2, '0') + '-' +
               String.valueOf(targetDate.year());
    }

    /**
     * @description Resolves cryptocurrency ticker to CoinGecko ID
     */
    private static String resolveGeckoId(String ticker) {
        if (String.isBlank(ticker)) return null;
        String t = ticker.trim().toUpperCase();
        return TICKER_TO_GECKO_ID.get(t);
    }

    /**
     * @description Perform a request to CoinGecko Simple Price API
     */
    private static HttpResponse doGeckoRequest(Set<String> geckoIds) {
        if (geckoIds == null || geckoIds.isEmpty()) return null;

        String idsParam = String.join(new List<String>(geckoIds), ',');
        String endpoint = 'callout:CoinGecko/api/v3/simple/price?ids='
            + EncodingUtil.urlEncode(idsParam, 'UTF-8')
            + '&vs_currencies=usd';

        HttpRequest req = new HttpRequest();
        req.setMethod('GET');
        req.setEndpoint(endpoint);
        req.setTimeout(30000);

        Http http = new Http();
        try {
            return http.send(req);
        } catch (System.CalloutException ex) {
            System.debug(LoggingLevel.WARN, 'HTTP callout failed: ' + ex.getMessage());
            return null;
        }
    }

    /**
     * @description Parse CoinGecko simple price API response
     */
    private static Map<String, Decimal> parseSimplePrice(String body) {
        Map<String, Decimal> priceMap = new Map<String, Decimal>();
        try {
            Object root = JSON.deserializeUntyped(body);
            if (!(root instanceof Map<String, Object>)) {
                return priceMap;
            }

            Map<String, Object> rootMap = (Map<String, Object>) root;
            for (String geckoId : rootMap.keySet()) {
                Object coinValue = rootMap.get(geckoId);
                if (coinValue instanceof Map<String, Object>) {
                    Map<String, Object> coinData = (Map<String, Object>) coinValue;
                    if (coinData.containsKey('usd')) {
                        Object usd = coinData.get('usd');
                        if (usd != null) {
                            Decimal price;
                            if (usd instanceof Decimal) {
                                price = (Decimal) usd;
                            } else {
                                price = Decimal.valueOf(String.valueOf(usd));
                            }
                            priceMap.put(geckoId, price);
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to parse CoinGecko response: ' + e.getMessage());
        }
        return priceMap;
    }
}