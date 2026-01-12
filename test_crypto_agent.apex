/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 11-07-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
// Simple test to verify CryptoPriceAgent works without cache issues
System.debug('Testing CryptoPriceAgent without cache...');

// Create a simple test with minimal requirements
List<CryptoPriceAgent.Request> requests = new List<CryptoPriceAgent.Request>();
requests.add(new CryptoPriceAgent.Request());

try {
    List<CryptoPriceAgent.Result> results = CryptoPriceAgent.getPrice(requests);
    System.debug('Success! Results count: ' + results.size());
    
    if (results.size() > 0) {
        System.debug('First result price: ' + results[0].price);
        System.debug('Signal: ' + results[0].signal);
        System.debug('Change percentage: ' + results[0].changePct);
    }
    System.debug('Test completed successfully!');
} catch (Exception e) {
    System.debug('Error occurred: ' + e.getMessage());
    System.debug('Stack trace: ' + e.getStackTraceString());
}
