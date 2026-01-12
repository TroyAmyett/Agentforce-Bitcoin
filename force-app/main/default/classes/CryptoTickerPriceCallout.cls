/**
 * @description Invocable class to perform an HTTP callout to CoinGecko
 * using a Named Credential.
 * The method fetches the current USD price for any cryptocurrency.
 *
 * NOTE: Requires a Named Credential named 'CoinGecko' pointing to https://api.coingecko.com.
 */
public with sharing class CryptoTickerPriceCallout {
    
    // Inner class representing the input structure for the Flow
    public class PriceRequest {
        @InvocableVariable(label='Crypto Ticker' description='The CoinGecko ID of the cryptocurrency (e.g., bitcoin, ethereum, cardano).' required=true)
        public String cryptoTicker;
    }
    
    // Inner class representing the output structure for the Flow
    public class PriceResult {
        @InvocableVariable(label='Crypto Name' description='The name of the cryptocurrency.')
        public String cryptoName;
        @InvocableVariable(label='USD Price' description='The current price in USD.')
        public Decimal usdPrice;
        @InvocableVariable(label='Success' description='Indicates if the callout was successful.')
        public Boolean isSuccess;
        @InvocableVariable(label='Error Message' description='Error message if the callout failed.')
        public String errorMessage;
    }
    
    /**
     * @description Invocable method to fetch the price of a crypto asset.
     * Accepts a dynamic crypto ticker from Flow and returns the current USD price.
     *
     * @param requests The list of input requests containing crypto tickers.
     * @return List<PriceResult> A list containing result objects with the fetched prices.
     */
    @InvocableMethod(label='Get CoinGecko Crypto Price' description='Fetches the current price of any cryptocurrency from CoinGecko.')
    public static List<PriceResult> getCryptoPrice(List<PriceRequest> requests) {
        List<PriceResult> results = new List<PriceResult>();
        
        // Process each request (typically Flow will send one at a time)
        for (PriceRequest request : requests) {
            if (String.isBlank(request.cryptoTicker)) {
                results.add(createErrorResult('Crypto ticker cannot be empty.'));
                continue;
            }
            
            // Convert ticker to lowercase for CoinGecko API
            String cryptoId = request.cryptoTicker.toLowerCase().trim();
            
            // 1. Define the Named Credential and the specific API path
            String namedCredential = 'callout:CoinGecko';
            String endpoint = namedCredential + '/api/v3/simple/price?ids=' + cryptoId + '&vs_currencies=usd';
            
            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('GET');
            req.setTimeout(60000); // 60 second timeout
            
            try {
                Http http = new Http();
                HttpResponse res = http.send(req);
                
                if (res.getStatusCode() == 200) {
                    // 2. Parse the response body (e.g., {"bitcoin": {"usd": 68000.00}})
                    Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                    
                    if (responseMap.containsKey(cryptoId)) {
                        Map<String, Object> cryptoDetails = (Map<String, Object>) responseMap.get(cryptoId);
                        
                        PriceResult result = new PriceResult();
                        result.cryptoName = formatCryptoName(cryptoId);
                        result.usdPrice = (Decimal) cryptoDetails.get('usd');
                        result.isSuccess = true;
                        result.errorMessage = null;
                        
                        results.add(result);
                    } else {
                        // Handle case where the crypto ticker is not found
                        results.add(createErrorResult('Cryptocurrency "' + cryptoId + '" not found. Please verify the CoinGecko ID.'));
                    }
                } else {
                    // Handle API error status codes
                    results.add(createErrorResult('CoinGecko API Error: Status ' + res.getStatusCode() + ', ' + res.getStatus()));
                }
            } catch (Exception e) {
                // Handle connection or parsing exceptions
                results.add(createErrorResult('Callout Exception: ' + e.getMessage()));
            }
        }
        
        // Must return a list, even if it contains a single result
        return results;
    }
    
    /**
     * @description Helper method to format crypto ticker into a display name.
     * @param cryptoId The CoinGecko ID (e.g., 'bitcoin').
     * @return String The formatted name (e.g., 'Bitcoin').
     */
    private static String formatCryptoName(String cryptoId) {
        if (String.isBlank(cryptoId)) {
            return '';
        }
        return cryptoId.substring(0, 1).toUpperCase() + cryptoId.substring(1);
    }
    
    /**
     * @description Helper method to create an error result.
     * @param errorMessage The error message to include.
     * @return PriceResult An error result object.
     */
    private static PriceResult createErrorResult(String errorMessage) {
        PriceResult errorResult = new PriceResult();
        errorResult.cryptoName = 'ERROR';
        errorResult.usdPrice = 0.00;
        errorResult.isSuccess = false;
        errorResult.errorMessage = errorMessage;
        System.debug('Callout Error: ' + errorMessage);
        // You might want to log this error to a custom object or platform event
        return errorResult;
    }
}