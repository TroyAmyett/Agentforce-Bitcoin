/**
 * Demo script showing how to run async Apex in VS Code without cache issues
 */

System.debug('=== Async Apex in VS Code - Working Example ===');

// Demonstrate proper async execution approach
System.debug('1. For scheduled jobs like GeckoScheduler:');
System.debug('   - Use System.schedule() to schedule recurring jobs');
System.debug('   - These run automatically according to cron expression');
System.debug('   - Example: System.schedule(\'MyJob\', \'0 * * * * ?\', new GeckoScheduler());');

System.debug('2. For immediate async execution:');
System.debug('   - Use Queueable Apex for complex async operations');
System.debug('   - Use @future methods for simple callouts');
System.debug('   - Execute directly in Developer Console or via CLI');

System.debug('3. To test your CryptoPriceAgent without cache issues:');
System.debug('   - Modify the class to remove cache dependency');
System.debug('   - Or create a test version that bypasses caching');

// Show how to properly test async behavior
System.debug('4. Best practices for testing async Apex:');
System.debug('   - Use Test.startTest() and Test.stopTest()');
System.debug('   - Query AsyncApexJob records to verify execution');
System.debug('   - Check Setup → Monitoring → Async Jobs');

// Demonstrate a simple queueable approach
System.debug('5. Example Queueable class structure:');
System.debug('   public class MyQueueable implements Queueable {');
System.debug('       public void execute(QueueableContext context) {');
System.debug('           // Your async logic here');
System.debug('       }');
System.debug('   }');

System.debug('6. To run queueable jobs:');
System.debug('   Id jobId = System.enqueueJob(new MyQueueable());');
