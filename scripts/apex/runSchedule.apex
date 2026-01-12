/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 11-06-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
// Schedule the Gecko Momentum Swarm job to run every minute
String jobId = System.schedule('Gecko Momentum Swarm', '0 * * * * ?', new GeckoScheduler());
System.debug('Scheduled job with ID: ' + jobId);
