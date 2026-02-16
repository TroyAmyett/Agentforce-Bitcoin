/**
 * @description Test class for SPAuthController - authentication,
 * registration, password management, and proxy methods.
 * @author Funnelists
 * @date 2026-02-10
 */
@IsTest
private class SPAuthControllerTest {

    @TestSetup
    static void setup() {
        SPTestDataFactory.setupFullEnvironment();
    }

    private static void initSettings() {
        SPTestDataFactory.setupSettingsCache();
        // Clear theme cache so it re-queries
        SPUtils.cachedTheme = null;
    }

    // ─── Login ──────────────────────────────────────────────────

    @IsTest
    static void testLoginSuccess() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);

        Map<String, Object> result = SPAuthController.login(
            SPTestDataFactory.TEST_EMAIL, SPTestDataFactory.TEST_PASSWORD
        );
        System.assertEquals(true, result.get('success'), 'Login should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertNotEquals(null, data.get('sessionToken'), 'Should include session token');
        System.assertEquals(SPTestDataFactory.TEST_EMAIL, data.get('username'), 'Username should match');
    }

    @IsTest
    static void testLoginWrongPassword() {
        initSettings();
        Map<String, Object> result = SPAuthController.login(
            SPTestDataFactory.TEST_EMAIL, 'WrongPassword1'
        );
        System.assertEquals(false, result.get('success'), 'Login should fail');
        System.assert(((String) result.get('error')).contains('Invalid'), 'Should say invalid');
    }

    @IsTest
    static void testLoginBadEmail() {
        initSettings();
        Map<String, Object> result = SPAuthController.login(
            'nobody@nowhere.com', SPTestDataFactory.TEST_PASSWORD
        );
        System.assertEquals(false, result.get('success'), 'Login should fail');
    }

    @IsTest
    static void testLoginEmptyInputs() {
        initSettings();
        Map<String, Object> result = SPAuthController.login('', '');
        System.assertEquals(false, result.get('success'), 'Should fail on empty inputs');
    }

    // ─── Register ───────────────────────────────────────────────

    @IsTest
    static void testRegisterAccountContact() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);

        Map<String, Object> result = SPAuthController.register(
            'New', 'User', 'newuser@sp-test.com', 'NewPass1!', 'New Company'
        );
        System.assertEquals(true, result.get('success'), 'Registration should succeed: ' + result.get('error'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertEquals('newuser@sp-test.com', data.get('username'));
    }

    @IsTest
    static void testRegisterDuplicateEmail() {
        initSettings();
        Map<String, Object> result = SPAuthController.register(
            'Dup', 'User', SPTestDataFactory.TEST_EMAIL, 'DupPass1!', 'Test Co'
        );
        System.assertEquals(false, result.get('success'), 'Duplicate should fail');
        System.assert(((String) result.get('error')).contains('already exists'));
    }

    @IsTest
    static void testRegisterEmptyInputs() {
        initSettings();
        Map<String, Object> result = SPAuthController.register('', '', '', 'Test1234!', '');
        System.assertEquals(false, result.get('success'), 'Empty inputs should fail');
    }

    @IsTest
    static void testRegisterWeakPassword() {
        initSettings();
        Map<String, Object> result = SPAuthController.register(
            'Weak', 'Pass', 'weak@sp-test.com', 'weak', ''
        );
        System.assertEquals(false, result.get('success'), 'Weak password should fail');
    }

    @IsTest
    static void testRegisterExistingOnlyMode() {
        // Set up Existing_Only mode
        SPUtils.cachedSettings = new Support_Portal__mdt(
            MasterLabel = 'Default',
            Registration_Mode__c = 'Existing_Only',
            Session_Duration_Minutes__c = 30
        );
        SPUtils.cachedTheme = null;

        // Create an unregistered Contact
        Account acct = [SELECT Id FROM Account LIMIT 1];
        Contact unregistered = new Contact(
            FirstName = 'Unregistered',
            LastName = 'Contact',
            Email = 'unregistered@sp-test.com',
            AccountId = acct.Id,
            SP_Enabled__c = false
        );
        insert unregistered;

        Test.setCurrentPage(Page.SPPortal);
        Map<String, Object> result = SPAuthController.register(
            'Unregistered', 'Contact', 'unregistered@sp-test.com', 'TestPass1!', ''
        );
        System.assertEquals(true, result.get('success'), 'Should succeed for existing contact: ' + result.get('error'));
    }

    @IsTest
    static void testRegisterExistingOnlyNoContact() {
        SPUtils.cachedSettings = new Support_Portal__mdt(
            MasterLabel = 'Default',
            Registration_Mode__c = 'Existing_Only',
            Session_Duration_Minutes__c = 30
        );
        SPUtils.cachedTheme = null;

        Map<String, Object> result = SPAuthController.register(
            'Ghost', 'User', 'ghost@sp-test.com', 'TestPass1!', ''
        );
        System.assertEquals(false, result.get('success'), 'Should fail - no existing contact');
    }

    @IsTest
    static void testRegisterNoCompanyName() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);

        Map<String, Object> result = SPAuthController.register(
            'No', 'Company', 'nocompany@sp-test.com', 'TestPass1!', ''
        );
        System.assertEquals(true, result.get('success'), 'Should succeed with default account: ' + result.get('error'));
    }

    // ─── Logout ─────────────────────────────────────────────────

    @IsTest
    static void testLogout() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);

        // Login first
        SPAuthController.login(SPTestDataFactory.TEST_EMAIL, SPTestDataFactory.TEST_PASSWORD);

        Map<String, Object> result = SPAuthController.logout();
        System.assertEquals(true, result.get('success'), 'Logout should succeed');
    }

    // ─── Get Current User ───────────────────────────────────────

    @IsTest
    static void testGetCurrentUserNoSession() {
        initSettings();
        Map<String, Object> result = SPAuthController.getCurrentUser();
        System.assertEquals(false, result.get('success'), 'Should fail without session');
    }

    // ─── Password Reset ─────────────────────────────────────────

    @IsTest
    static void testResetPasswordRequest() {
        initSettings();
        Map<String, Object> result = SPAuthController.resetPasswordRequest(SPTestDataFactory.TEST_EMAIL);
        System.assertEquals(true, result.get('success'), 'Reset request should always succeed');
    }

    @IsTest
    static void testResetPasswordRequestNonexistent() {
        initSettings();
        // Should still return success to prevent email enumeration
        Map<String, Object> result = SPAuthController.resetPasswordRequest('nobody@nowhere.com');
        System.assertEquals(true, result.get('success'), 'Should succeed even for nonexistent email');
    }

    @IsTest
    static void testResetPasswordRequestEmpty() {
        initSettings();
        Map<String, Object> result = SPAuthController.resetPasswordRequest('');
        System.assertEquals(false, result.get('success'), 'Empty email should fail');
    }

    @IsTest
    static void testResetPassword() {
        initSettings();
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        // Set a reset token
        String token = SPUtils.generateResetToken();
        con.SP_Reset_Token__c = token;
        con.SP_Reset_Token_Expiry__c = Datetime.now().addHours(24);
        update con;

        Map<String, Object> result = SPAuthController.resetPassword(
            con.Id, token, 'NewPass1!'
        );
        System.assertEquals(true, result.get('success'), 'Reset should succeed');
    }

    @IsTest
    static void testResetPasswordBadToken() {
        initSettings();
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPAuthController.resetPassword(
            con.Id, 'badtoken', 'NewPass1!'
        );
        System.assertEquals(false, result.get('success'), 'Bad token should fail');
    }

    @IsTest
    static void testResetPasswordEmpty() {
        initSettings();
        Map<String, Object> result = SPAuthController.resetPassword('', '', '');
        System.assertEquals(false, result.get('success'), 'Empty inputs should fail');
    }

    // ─── Change Password ────────────────────────────────────────

    @IsTest
    static void testChangePassword() {
        initSettings();
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPAuthController.changePassword(
            con.Id, SPTestDataFactory.TEST_PASSWORD, 'NewPass1!'
        );
        System.assertEquals(true, result.get('success'), 'Change should succeed');
    }

    @IsTest
    static void testChangePasswordWrongCurrent() {
        initSettings();
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPAuthController.changePassword(
            con.Id, 'WrongCurrent1', 'NewPass1!'
        );
        System.assertEquals(false, result.get('success'), 'Wrong current password should fail');
    }

    @IsTest
    static void testChangePasswordWeakNew() {
        initSettings();
        Contact con = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPAuthController.changePassword(
            con.Id, SPTestDataFactory.TEST_PASSWORD, 'weak'
        );
        System.assertEquals(false, result.get('success'), 'Weak new password should fail');
    }

    // ─── Constructor + checkSession ────────────────────────────

    @IsTest
    static void testConstructorAndCheckSession() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);

        SPAuthController controller = new SPAuthController();
        PageReference result = controller.checkSession();
        System.assertEquals(null, result, 'checkSession should return null');
        System.assertNotEquals(null, controller.companyName, 'Company name should be set');
    }

    // ─── Proxy Methods (ensure they compile and run) ────────────

    @IsTest
    static void testGetPortalConfig() {
        initSettings();
        Map<String, Object> result = SPAuthController.getPortalConfig();
        System.assertEquals(true, result.get('success'), 'getPortalConfig should succeed');
    }
}
