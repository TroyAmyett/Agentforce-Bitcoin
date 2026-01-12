/**
 * @description       : Agent to retrieve cryptocurrency prices from CoinGecko API
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 11-07-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public class CryptoPriceAgent {
    @InvocableMethod(label='BTC Live Price v25' description='Agentforce-native | $41/hr swarm')
    public static List<Result> getPrice(List<Request> requests) {
        Http h = new Http();
        HttpRequest r = new HttpRequest();
        r.setEndpoint('callout:CoinGecko_Legend/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        r.setMethod('GET');
        r.setHeader('accept','application/json');
        HttpResponse res = h.send(r);

        Decimal price = (Decimal)((Map<String,Object>)((Map<String,Object>)JSON.deserializeUntyped(res.getBody())).get('bitcoin')).get('usd');
        
        // Calculate percentage change without cache
        Decimal pct = 0; // Default to 0 when no previous value available

        Result out = new Result();
        out.price     = price.setScale(2);
        out.changePct = pct;
        out.signal    = pct > 0.5 ? 'BUY' : (pct < -0.5 ? 'SELL' : 'HOLD');
        out.timestamp = System.now().format();
        
        System.debug('AGENTFORCE BTC: $'+out.price+' Δ'+out.changePct+'% → '+out.signal);
        return new List<Result>{ out };
    }

    public class Request { 
        @InvocableVariable(required=false) public String dummy; 
    }
    public class Result {
        @InvocableVariable public Decimal price;
        @InvocableVariable public Decimal changePct;
        @InvocableVariable public String  signal;
        @InvocableVariable public String  timestamp;
    }
}