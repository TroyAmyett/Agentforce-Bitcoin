/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 11-07-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
// Temporary script to run CryptoPriceAgent.getPrice()
System.debug('Running CryptoPriceAgent.getPrice()...');
List<CryptoPriceAgent.Result> results = CryptoPriceAgent.getPrice(new List<CryptoPriceAgent.Request>{new CryptoPriceAgent.Request()});
System.debug('Results: ' + results);
if (results.size() > 0) {
    System.debug('First result price: ' + results[0].price);
} else {
    System.debug('No results returned');
}
