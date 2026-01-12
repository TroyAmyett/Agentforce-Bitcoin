/**
 * @description       : Unit tests for GeckoScheduler class
 * @author            : Troy Amyett
 * @group             : AgentForce Legend
 * @last modified on  : 01-11-2026
 **/
@IsTest
public class GeckoSchedulerTest {

    // Mock for successful CoinGecko response
    private class MockCoinGeckoSuccess implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('{"bitcoin":{"usd":95000.50},"ethereum":{"usd":3200.75},"solana":{"usd":145.25}}');
            return res;
        }
    }

    /**
     * @description Test the execute method (Schedulable interface)
     */
    @IsTest
    static void testExecute() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        GeckoScheduler scheduler = new GeckoScheduler();
        scheduler.execute(null);
        Test.stopTest();

        // Verify records were created
        List<BTC_Price__c> records = [SELECT Id, Symbol__c FROM BTC_Price__c];
        System.assert(records.size() > 0, 'Should create price records');
    }

    /**
     * @description Test the execute method with custom symbols
     */
    @IsTest
    static void testExecute_CustomSymbols() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        GeckoScheduler scheduler = new GeckoScheduler('BTC,ETH');
        scheduler.execute(null);
        Test.stopTest();

        List<BTC_Price__c> records = [SELECT Id, Symbol__c FROM BTC_Price__c];
        System.assert(records.size() > 0, 'Should create price records');
    }

    /**
     * @description Test the refreshCryptoData static method
     */
    @IsTest
    static void testRefreshCryptoData() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        GeckoScheduler.refreshCryptoData();
        Test.stopTest();

        // If we reach here without exception, the test passes
        System.assert(true, 'refreshCryptoData method executed without error');
    }

    /**
     * @description Test the refreshCryptoData static method with custom symbols
     */
    @IsTest
    static void testRefreshCryptoData_WithSymbols() {
        Test.setMock(HttpCalloutMock.class, new MockCoinGeckoSuccess());

        Test.startTest();
        GeckoScheduler.refreshCryptoData('BTC,ETH');
        Test.stopTest();

        System.assert(true, 'refreshCryptoData with symbols executed without error');
    }

    /**
     * @description Test the scheduleCryptoRefresh method with valid inputs
     */
    @IsTest
    static void testScheduleCryptoRefresh_ValidInputs() {
        Test.startTest();
        String jobId = GeckoScheduler.scheduleCryptoRefresh(2, 0, 'BTC');
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Should return a valid job ID');
    }

    /**
     * @description Test the scheduleCryptoRefresh method with null inputs (uses defaults)
     */
    @IsTest
    static void testScheduleCryptoRefresh_NullInputs() {
        Test.startTest();
        String jobId = GeckoScheduler.scheduleCryptoRefresh(null, null, null);
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Should return a valid job ID with defaults');
    }

    /**
     * @description Test the scheduleCryptoRefresh method with invalid hour
     */
    @IsTest
    static void testScheduleCryptoRefresh_InvalidHour() {
        Test.startTest();
        // Test with invalid hour (should default to 2)
        String jobId = GeckoScheduler.scheduleCryptoRefresh(25, 0, null);
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Should return a valid job ID even with invalid hour');
    }

    /**
     * @description Test the scheduleCryptoRefresh method with invalid minute
     */
    @IsTest
    static void testScheduleCryptoRefresh_InvalidMinute() {
        Test.startTest();
        String jobId = GeckoScheduler.scheduleCryptoRefresh(2, 70, null);
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Should return a valid job ID even with invalid minute');
    }

    /**
     * @description Test the scheduleEveryNMinutes method
     */
    @IsTest
    static void testScheduleEveryNMinutes() {
        Test.startTest();
        String jobId = GeckoScheduler.scheduleEveryNMinutes(10, 'BTC');
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Should return a valid job ID');
    }

    /**
     * @description Test the scheduleEveryNMinutes method with too small interval
     */
    @IsTest
    static void testScheduleEveryNMinutes_TooSmall() {
        Test.startTest();
        // Should default to minimum 5 minutes
        String jobId = GeckoScheduler.scheduleEveryNMinutes(1, 'BTC');
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Should return a valid job ID');
    }

    /**
     * @description Test the unscheduleCryptoRefresh method with fake ID
     */
    @IsTest
    static void testUnscheduleCryptoRefresh_FakeId() {
        Test.startTest();
        Boolean result = GeckoScheduler.unscheduleCryptoRefresh('fake-job-id');
        Test.stopTest();

        System.assertEquals(false, result, 'Should return false for invalid job ID');
    }

    /**
     * @description Test the unscheduleCryptoRefresh method with blank ID
     */
    @IsTest
    static void testUnscheduleCryptoRefresh_BlankId() {
        Test.startTest();
        Boolean result = GeckoScheduler.unscheduleCryptoRefresh('');
        Test.stopTest();

        System.assertEquals(false, result, 'Should return false for blank job ID');
    }

    /**
     * @description Test the unscheduleCryptoRefresh method with null ID
     */
    @IsTest
    static void testUnscheduleCryptoRefresh_NullId() {
        Test.startTest();
        Boolean result = GeckoScheduler.unscheduleCryptoRefresh(null);
        Test.stopTest();

        System.assertEquals(false, result, 'Should return false for null job ID');
    }

    /**
     * @description Test schedule and unschedule flow
     */
    @IsTest
    static void testScheduleAndUnschedule() {
        Test.startTest();
        String jobId = GeckoScheduler.scheduleCryptoRefresh(3, 30, 'BTC,ETH');
        System.assertNotEquals(null, jobId, 'Should schedule successfully');

        Boolean unscheduled = GeckoScheduler.unscheduleCryptoRefresh(jobId);
        Test.stopTest();

        System.assertEquals(true, unscheduled, 'Should unschedule successfully');
    }

    /**
     * @description Test the getScheduledJobs method
     */
    @IsTest
    static void testGetScheduledJobs() {
        Test.startTest();
        List<String> jobs = GeckoScheduler.getScheduledJobs();
        Test.stopTest();

        System.assertNotEquals(null, jobs, 'Should return a list of scheduled jobs');
    }

    /**
     * @description Test getScheduledJobs after scheduling
     */
    @IsTest
    static void testGetScheduledJobs_AfterScheduling() {
        Test.startTest();
        String jobId = GeckoScheduler.scheduleCryptoRefresh(4, 0, 'BTC');
        List<String> jobs = GeckoScheduler.getScheduledJobs();
        Test.stopTest();

        System.assert(jobs.size() > 0, 'Should find the scheduled job');
        System.assert(jobs[0].contains('GeckoSwarm_'), 'Job name should contain GeckoSwarm_');
    }

    /**
     * @description Test default constructor
     */
    @IsTest
    static void testDefaultConstructor() {
        GeckoScheduler scheduler = new GeckoScheduler();
        System.assertNotEquals(null, scheduler, 'Should create scheduler with default constructor');
    }

    /**
     * @description Test parameterized constructor with blank symbols
     */
    @IsTest
    static void testParameterizedConstructor_BlankSymbols() {
        GeckoScheduler scheduler = new GeckoScheduler('');
        System.assertNotEquals(null, scheduler, 'Should create scheduler with blank symbols');
    }
}