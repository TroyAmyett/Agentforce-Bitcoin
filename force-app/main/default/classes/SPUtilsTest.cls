/**
 * @description Test class for SPUtils - core utility methods.
 * @author Funnelists
 * @date 2026-02-10
 */
@IsTest
private class SPUtilsTest {

    @TestSetup
    static void setup() {
        SPTestDataFactory.setupSettingsCache();
        Account acct = SPTestDataFactory.createAccount('Utils Test Co');
        SPTestDataFactory.createPortalContact(acct, 'Test', 'User', SPTestDataFactory.TEST_EMAIL, 'User');
        SPTestDataFactory.createDefaultTheme();
    }

    // ─── Password Hashing ────────────────────────────────────────

    @IsTest
    static void testHashPassword() {
        String hash1 = SPUtils.hashPassword('password123');
        String hash2 = SPUtils.hashPassword('password123');
        String hash3 = SPUtils.hashPassword('different');

        System.assertNotEquals(null, hash1, 'Hash should not be null');
        System.assertEquals(hash1, hash2, 'Same input should produce same hash');
        System.assertNotEquals(hash1, hash3, 'Different inputs should produce different hashes');
    }

    @IsTest
    static void testValidatePassword() {
        String hash = SPUtils.hashPassword('Test1234!');

        System.assertEquals(true, SPUtils.validatePassword('Test1234!', hash), 'Correct password should validate');
        System.assertEquals(false, SPUtils.validatePassword('WrongPass1', hash), 'Wrong password should not validate');
        System.assertEquals(false, SPUtils.validatePassword(null, hash), 'Null password should not validate');
        System.assertEquals(false, SPUtils.validatePassword('Test1234!', null), 'Null hash should not validate');
        System.assertEquals(false, SPUtils.validatePassword('', ''), 'Empty strings should not validate');
    }

    @IsTest
    static void testValidatePasswordComplexity() {
        System.assertNotEquals(null, SPUtils.validatePasswordComplexity(null), 'Null should fail');
        System.assertNotEquals(null, SPUtils.validatePasswordComplexity(''), 'Empty should fail');
        System.assertNotEquals(null, SPUtils.validatePasswordComplexity('short'), 'Too short should fail');
        System.assertNotEquals(null, SPUtils.validatePasswordComplexity('alllowercase1'), 'No uppercase should fail');
        System.assertNotEquals(null, SPUtils.validatePasswordComplexity('NoNumbers'), 'No digits should fail');
        System.assertEquals(null, SPUtils.validatePasswordComplexity('ValidPass1'), 'Valid password should pass');
    }

    // ─── Token Generation ────────────────────────────────────────

    @IsTest
    static void testGenerateResetToken() {
        String token1 = SPUtils.generateResetToken();
        String token2 = SPUtils.generateResetToken();

        System.assertNotEquals(null, token1, 'Token should not be null');
        System.assertEquals(32, token1.length(), 'Token should be 32 chars');
        System.assertNotEquals(token1, token2, 'Tokens should be unique');
    }

    @IsTest
    static void testGetResetTokenExpiry() {
        Datetime before = Datetime.now().addHours(23);
        Datetime expiry = SPUtils.getResetTokenExpiry();
        Datetime after = Datetime.now().addHours(25);

        System.assert(expiry > before, 'Expiry should be > 23h from now');
        System.assert(expiry < after, 'Expiry should be < 25h from now');
    }

    // ─── Response Builders ───────────────────────────────────────

    @IsTest
    static void testSuccessResponse() {
        Map<String, Object> resp = SPUtils.successResponse('test data');
        System.assertEquals(true, resp.get('success'), 'Should be success');
        System.assertEquals('test data', resp.get('data'), 'Data should match');
    }

    @IsTest
    static void testErrorResponse() {
        Map<String, Object> resp = SPUtils.errorResponse('something failed');
        System.assertEquals(false, resp.get('success'), 'Should be failure');
        System.assertEquals('something failed', resp.get('error'), 'Error should match');
    }

    // ─── Configuration ──────────────────────────────────────────

    @IsTest
    static void testGetSettings() {
        SPTestDataFactory.setupSettingsCache();
        Support_Portal__mdt settings = SPUtils.getSettings();
        System.assertNotEquals(null, settings, 'Settings should not be null');
        System.assertEquals('Account_Contact', settings.Registration_Mode__c, 'Registration mode should match');
    }

    @IsTest
    static void testGetTheme() {
        SP_Portal_Theme__c theme = SPUtils.getTheme();
        System.assertNotEquals(null, theme, 'Theme should not be null');
        System.assertEquals('Test Corp', theme.Company_Name__c, 'Company name should match');
    }

    @IsTest
    static void testGetSessionDuration() {
        SPTestDataFactory.setupSettingsCache();
        Integer duration = SPUtils.getSessionDuration();
        System.assertEquals(30, duration, 'Duration should be 30 minutes');
    }

    @IsTest
    static void testGetSessionDurationDefault() {
        SPUtils.cachedSettings = new Support_Portal__mdt(
            MasterLabel = 'Default',
            Session_Duration_Minutes__c = null
        );
        Integer duration = SPUtils.getSessionDuration();
        System.assertEquals(30, duration, 'Should fall back to default 30 minutes');
    }

    // ─── User Queries ───────────────────────────────────────────

    @IsTest
    static void testGetPortalUser() {
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Contact result = SPUtils.getPortalUser(con.Id);
        System.assertNotEquals(null, result, 'Should find portal user');
        System.assertEquals(SPTestDataFactory.TEST_EMAIL, result.SP_Username__c, 'Username should match');
    }

    @IsTest
    static void testGetPortalUserNotFound() {
        // Use a fabricated Id that doesn't exist
        Contact result = SPUtils.getPortalUser(null);
        System.assertEquals(null, result, 'Should return null for null Id');
    }

    @IsTest
    static void testFindUserByUsername() {
        Contact result = SPUtils.findUserByUsername(SPTestDataFactory.TEST_EMAIL);
        System.assertNotEquals(null, result, 'Should find user by username');
        System.assertEquals(SPTestDataFactory.TEST_EMAIL, result.SP_Username__c);
    }

    @IsTest
    static void testFindUserByUsernameNotFound() {
        System.assertEquals(null, SPUtils.findUserByUsername('nonexistent@test.com'), 'Should return null');
        System.assertEquals(null, SPUtils.findUserByUsername(null), 'Null should return null');
        System.assertEquals(null, SPUtils.findUserByUsername(''), 'Empty should return null');
    }

    @IsTest
    static void testFindContactByEmail() {
        Contact result = SPUtils.findContactByEmail(SPTestDataFactory.TEST_EMAIL);
        System.assertNotEquals(null, result, 'Should find contact by email');
    }

    @IsTest
    static void testFindContactByEmailNotFound() {
        System.assertEquals(null, SPUtils.findContactByEmail(null), 'Null should return null');
        System.assertEquals(null, SPUtils.findContactByEmail(''), 'Empty should return null');
    }

    // ─── Session Management ─────────────────────────────────────

    @IsTest
    static void testCreateAndValidateSession() {
        SPTestDataFactory.setupSettingsCache();
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        // Set up a page context for cookie operations
        Test.setCurrentPage(Page.SPPortal);

        Cookie sessionCookie = SPUtils.createSession(con.Id);
        System.assertNotEquals(null, sessionCookie, 'Cookie should not be null');
        System.assertNotEquals(null, sessionCookie.getValue(), 'Cookie value should not be null');

        // Validate using token string
        Contact validated = SPUtils.validateSession(sessionCookie.getValue());
        System.assertNotEquals(null, validated, 'Should validate session');
        System.assertEquals(con.Id, validated.Id, 'Should return correct user');
    }

    @IsTest
    static void testValidateSessionInvalid() {
        SPTestDataFactory.setupSettingsCache();
        System.assertEquals(null, SPUtils.validateSession(null), 'Null token should return null');
        System.assertEquals(null, SPUtils.validateSession(''), 'Empty token should return null');
        System.assertEquals(null, SPUtils.validateSession('invalid---token'), 'Bad token should return null');
        System.assertEquals(null, SPUtils.validateSession('notanid'), 'Single part should return null');
    }

    @IsTest
    static void testValidateSessionExpired() {
        SPTestDataFactory.setupSettingsCache();
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        // Create an expired session
        SP_Session__c session = new SP_Session__c(
            User__c = con.Id,
            Session_Start__c = Datetime.now().addHours(-2),
            Session_End__c = Datetime.now().addMinutes(-1)
        );
        insert session;

        String token = con.Id + '---' + session.Id + '---' + String.valueOf(Datetime.now().getTime());
        Contact result = SPUtils.validateSession(token);
        System.assertEquals(null, result, 'Expired session should return null');
    }

    @IsTest
    static void testDestroySession() {
        SPTestDataFactory.setupSettingsCache();
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Test.setCurrentPage(Page.SPPortal);
        Cookie sessionCookie = SPUtils.createSession(con.Id);
        ApexPages.currentPage().setCookies(new Cookie[]{ sessionCookie });

        Cookie deadCookie = SPUtils.destroySession();
        System.assertNotEquals(null, deadCookie, 'Should return a dead cookie');
        System.assertEquals('', deadCookie.getValue(), 'Dead cookie value should be empty');
    }
}
