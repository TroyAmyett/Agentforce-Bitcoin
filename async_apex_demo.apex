/**
 * Demo script showing different ways to run async Apex in VS Code
 */

// 1. Running a scheduled job (your existing GeckoScheduler)
System.debug('=== Testing Scheduled Job Approach ===');
try {
    // This would normally be run from the Developer Console or via CLI
    // We're demonstrating the concept here
    System.debug('To schedule a job, use:');
    System.debug('System.schedule(\'JobName\', \'0 * * * * ?\', new GeckoScheduler());');
} catch (Exception e) {
    System.debug('Error: ' + e.getMessage());
}

// 2. Demonstrating how to run a simple Apex method
System.debug('=== Testing Simple Apex Method ===');
try {
    // Create a simple test class to demonstrate async concepts
    System.debug('In VS Code, you can run Apex scripts using:');
    System.debug('- sf apex run -f script.apex -o org_alias');
    System.debug('- Or use the Execute Anonymous window in Developer Console');
} catch (Exception e) {
    System.debug('Error: ' + e.getMessage());
}

// 3. Showing how to test async behavior
System.debug('=== Testing Async Behavior ===');
System.debug('To properly test async Apex:');
System.debug('1. Use Test.startTest() and Test.stopTest()');
System.debug('2. Check AsyncApexJob records');
System.debug('3. Monitor execution in Setup → Monitoring → Async Jobs');
