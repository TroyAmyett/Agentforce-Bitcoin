/**
 * @description Test class for SPAdminController - user management,
 * role assignment, portal statistics, and settings.
 * @author Funnelists
 * @date 2026-02-10
 */
@IsTest
private class SPAdminControllerTest {

    @TestSetup
    static void setup() {
        SPTestDataFactory.setupFullEnvironment();
    }

    private static void initSettings() {
        SPTestDataFactory.setupSettingsCache();
        SPUtils.cachedTheme = null;
    }

    private static String getAdminToken() {
        Contact admin = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.ADMIN_EMAIL LIMIT 1];
        return SPTestDataFactory.createTestSession(admin);
    }

    private static String getUserToken() {
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        return SPTestDataFactory.createTestSession(user);
    }

    // ─── Get Portal Users ───────────────────────────────────────

    @IsTest
    static void testGetPortalUsersSuccess() {
        initSettings();
        String token = getAdminToken();

        Map<String, Object> result = SPAdminController.getPortalUsers(1, null, token);
        System.assertEquals(true, result.get('success'), 'Should succeed for admin');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> users = (List<Object>) data.get('users');
        System.assert(users.size() >= 2, 'Should have at least 2 users');
    }

    @IsTest
    static void testGetPortalUsersWithSearch() {
        initSettings();
        String token = getAdminToken();

        Map<String, Object> result = SPAdminController.getPortalUsers(1, 'Admin', token);
        System.assertEquals(true, result.get('success'));
    }

    @IsTest
    static void testGetPortalUsersUnauthorized() {
        initSettings();
        String userToken = getUserToken();

        Map<String, Object> result = SPAdminController.getPortalUsers(1, null, userToken);
        System.assertEquals(false, result.get('success'), 'Regular user should be denied');
    }

    @IsTest
    static void testGetPortalUsersInvalidSession() {
        initSettings();
        Map<String, Object> result = SPAdminController.getPortalUsers(1, null, 'invalid---token---123');
        System.assertEquals(false, result.get('success'), 'Invalid session should fail');
    }

    // ─── Update User Status ─────────────────────────────────────

    @IsTest
    static void testUpdateUserStatus() {
        initSettings();
        String adminToken = getAdminToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPAdminController.updateUserStatus(user.Id, 'Inactive', adminToken);
        System.assertEquals(true, result.get('success'), 'Status update should succeed');

        Contact updated = [SELECT SP_Status__c, SP_Enabled__c FROM Contact WHERE Id = :user.Id];
        System.assertEquals('Inactive', updated.SP_Status__c);
        System.assertEquals(false, updated.SP_Enabled__c);
    }

    @IsTest
    static void testUpdateUserStatusReactivate() {
        initSettings();
        String adminToken = getAdminToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        // Deactivate then reactivate
        SPAdminController.updateUserStatus(user.Id, 'Inactive', adminToken);
        Map<String, Object> result = SPAdminController.updateUserStatus(user.Id, 'Active', adminToken);
        System.assertEquals(true, result.get('success'));

        Contact updated = [SELECT SP_Enabled__c FROM Contact WHERE Id = :user.Id];
        System.assertEquals(true, updated.SP_Enabled__c);
    }

    @IsTest
    static void testUpdateUserStatusUnauthorized() {
        initSettings();
        String userToken = getUserToken();
        Contact admin = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.ADMIN_EMAIL LIMIT 1];

        Map<String, Object> result = SPAdminController.updateUserStatus(admin.Id, 'Inactive', userToken);
        System.assertEquals(false, result.get('success'), 'Non-admin should be denied');
    }

    @IsTest
    static void testUpdateUserStatusNotFound() {
        initSettings();
        String adminToken = getAdminToken();

        Map<String, Object> result = SPAdminController.updateUserStatus('003000000000000', 'Active', adminToken);
        System.assertEquals(false, result.get('success'), 'Non-existent user should fail');
    }

    // ─── Update User Role ───────────────────────────────────────

    @IsTest
    static void testUpdateUserRole() {
        initSettings();
        String adminToken = getAdminToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPAdminController.updateUserRole(user.Id, 'Portal Admin', adminToken);
        System.assertEquals(true, result.get('success'), 'Role update should succeed');

        Contact updated = [SELECT SP_Role__c FROM Contact WHERE Id = :user.Id];
        System.assertEquals('Portal Admin', updated.SP_Role__c);
    }

    @IsTest
    static void testUpdateUserRoleSuperAdminGrant() {
        initSettings();
        String adminToken = getAdminToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        // Requires SP_Manage_Super_Admin custom permission on the running user.
        // If not present, the controller should catch the DmlException gracefully.
        Map<String, Object> result = SPAdminController.updateUserRole(user.Id, 'Super Admin', adminToken);

        Boolean hasPerm = FeatureManagement.checkPermission('SP_Manage_Super_Admin');
        if (hasPerm) {
            System.assertEquals(true, result.get('success'), 'Super Admin grant should succeed with permission');
        } else {
            // Validation rule blocks it - verify graceful error handling
            System.assertEquals(false, result.get('success'), 'Should fail without custom permission');
            System.assert(
                ((String) result.get('error')).contains('Super Admin'),
                'Error should mention Super Admin permission'
            );
        }
    }

    @IsTest
    static void testUpdateUserRolePortalAdminCannotEscalate() {
        initSettings();
        // Create a Portal Admin
        Account acct = [SELECT Id FROM Account LIMIT 1];
        Contact portalAdmin = SPTestDataFactory.createPortalContact(
            acct, 'Portal', 'Admin', 'portaladmin@sp-test.com', 'Portal Admin'
        );
        String paToken = SPTestDataFactory.createTestSession(portalAdmin);

        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        // Portal Admin cannot grant Super Admin
        Map<String, Object> result = SPAdminController.updateUserRole(user.Id, 'Super Admin', paToken);
        System.assertEquals(false, result.get('success'), 'Portal Admin cannot grant Super Admin');

        // Portal Admin cannot create Portal Admin
        Map<String, Object> result2 = SPAdminController.updateUserRole(user.Id, 'Portal Admin', paToken);
        System.assertEquals(false, result2.get('success'), 'Portal Admin cannot create Portal Admin');
    }

    @IsTest
    static void testUpdateUserRoleUnauthorized() {
        initSettings();
        String userToken = getUserToken();
        Contact admin = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.ADMIN_EMAIL LIMIT 1];

        Map<String, Object> result = SPAdminController.updateUserRole(admin.Id, 'User', userToken);
        System.assertEquals(false, result.get('success'), 'Regular user should be denied');
    }

    // ─── Portal Statistics ──────────────────────────────────────

    @IsTest
    static void testGetPortalStats() {
        initSettings();
        String adminToken = getAdminToken();

        Map<String, Object> result = SPAdminController.getPortalStats(adminToken);
        System.assertEquals(true, result.get('success'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        Map<String, Object> userStats = (Map<String, Object>) data.get('users');
        Map<String, Object> caseStats = (Map<String, Object>) data.get('cases');

        System.assertNotEquals(null, userStats.get('total'));
        System.assertNotEquals(null, caseStats.get('total'));
    }

    @IsTest
    static void testGetPortalStatsUnauthorized() {
        initSettings();
        String userToken = getUserToken();

        Map<String, Object> result = SPAdminController.getPortalStats(userToken);
        System.assertEquals(false, result.get('success'));
    }

    // ─── Portal Settings ────────────────────────────────────────

    @IsTest
    static void testGetPortalSettings() {
        initSettings();
        String adminToken = getAdminToken();

        Map<String, Object> result = SPAdminController.getPortalSettings(adminToken);
        System.assertEquals(true, result.get('success'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertNotEquals(null, data.get('registrationMode'));
    }

    @IsTest
    static void testSavePortalSettings() {
        initSettings();
        String adminToken = getAdminToken();

        String configJson = '{"showProduct":true,"productOptions":"Radar,Canvas,AgentPM"}';
        Map<String, Object> result = SPAdminController.savePortalSettings(configJson, adminToken);
        System.assertEquals(true, result.get('success'), 'Save should succeed');
    }

    @IsTest
    static void testSavePortalSettingsUnauthorized() {
        initSettings();
        String userToken = getUserToken();

        Map<String, Object> result = SPAdminController.savePortalSettings('{}', userToken);
        System.assertEquals(false, result.get('success'), 'Non-admin should be denied');
    }

    // ─── Extension Constructor ──────────────────────────────────

    @IsTest
    static void testExtensionConstructor() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);
        SPAuthController auth = new SPAuthController();
        SPAdminController adminCtrl = new SPAdminController(auth);
        System.assertNotEquals(null, adminCtrl);
    }
}
