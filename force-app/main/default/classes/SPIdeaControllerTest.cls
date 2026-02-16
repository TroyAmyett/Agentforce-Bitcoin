/**
 * @description Test class for SPIdeaController - Ideas CRUD,
 * voting, and status management.
 * @author Funnelists
 * @date 2026-02-10
 */
@IsTest
private class SPIdeaControllerTest {

    @TestSetup
    static void setup() {
        Map<String, Object> env = SPTestDataFactory.setupFullEnvironment();
        Contact user = (Contact) env.get('user');
        SPTestDataFactory.createTestIdea(user, 'Feature Request: Dark Mode', 'Feature');
        SPTestDataFactory.createTestIdea(user, 'Bug Report: Slow Load', 'Bug');
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

    // ─── Get Ideas ──────────────────────────────────────────────

    @IsTest
    static void testGetIdeasSuccess() {
        initSettings();
        String token = getUserToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPIdeaController.getIdeas(user.Id, null, 1, token);
        System.assertEquals(true, result.get('success'), 'Should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> ideas = (List<Object>) data.get('ideas');
        System.assert(ideas.size() >= 2, 'Should have at least 2 ideas');
    }

    @IsTest
    static void testGetIdeasWithFilter() {
        initSettings();
        String token = getUserToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPIdeaController.getIdeas(user.Id, 'Feature', 1, token);
        System.assertEquals(true, result.get('success'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> ideas = (List<Object>) data.get('ideas');
        System.assert(ideas.size() >= 1, 'Should have at least 1 feature idea');
    }

    @IsTest
    static void testGetIdeasAllFilter() {
        initSettings();
        String token = getUserToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPIdeaController.getIdeas(user.Id, 'All', 1, token);
        System.assertEquals(true, result.get('success'), 'All filter should succeed');
    }

    @IsTest
    static void testGetIdeasInvalidSession() {
        initSettings();
        Map<String, Object> result = SPIdeaController.getIdeas('003000000000000', null, 1, 'bad---token---123');
        System.assertEquals(false, result.get('success'));
    }

    // ─── Create Idea ────────────────────────────────────────────

    @IsTest
    static void testCreateIdea() {
        initSettings();
        String token = getUserToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPIdeaController.createIdea(
            user.Id, 'New Feature Request', 'Description here', 'Feature', 'Radar', token
        );
        System.assertEquals(true, result.get('success'), 'Create should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertEquals('New Feature Request', data.get('title'));
    }

    @IsTest
    static void testCreateIdeaDefaultCategory() {
        initSettings();
        String token = getUserToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPIdeaController.createIdea(
            user.Id, 'No Category Idea', 'Desc', '', null, token
        );
        System.assertEquals(true, result.get('success'));
    }

    @IsTest
    static void testCreateIdeaEmptyTitle() {
        initSettings();
        String token = getUserToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPIdeaController.createIdea(user.Id, '', 'Desc', 'Feature', null, token);
        System.assertEquals(false, result.get('success'), 'Empty title should fail');
    }

    @IsTest
    static void testCreateIdeaInvalidSession() {
        initSettings();
        Map<String, Object> result = SPIdeaController.createIdea(
            '003000000000000', 'Title', 'Desc', 'Feature', null, 'bad---token---123'
        );
        System.assertEquals(false, result.get('success'));
    }

    // ─── Vote for Idea ──────────────────────────────────────────

    @IsTest
    static void testVoteForIdea() {
        initSettings();
        Contact admin = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.ADMIN_EMAIL LIMIT 1];
        String adminToken = SPTestDataFactory.createTestSession(admin);

        SP_Idea__c idea = [SELECT Id FROM SP_Idea__c LIMIT 1];

        // Vote (admin hasn't voted yet)
        Map<String, Object> result = SPIdeaController.voteForIdea(admin.Id, idea.Id, adminToken);
        System.assertEquals(true, result.get('success'), 'Vote should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertEquals(true, data.get('voted'), 'Should be voted');
        System.assertEquals(2, data.get('votes'), 'Should have 2 votes');
    }

    @IsTest
    static void testUnvote() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        String userToken = SPTestDataFactory.createTestSession(user);

        // User already voted on all ideas via createTestIdea
        SP_Idea__c idea = [SELECT Id FROM SP_Idea__c LIMIT 1];

        // Unvote (user already voted via createTestIdea)
        Map<String, Object> result = SPIdeaController.voteForIdea(user.Id, idea.Id, userToken);
        System.assertEquals(true, result.get('success'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertEquals(false, data.get('voted'), 'Should be unvoted');
    }

    @IsTest
    static void testVoteInvalidSession() {
        initSettings();
        SP_Idea__c idea = [SELECT Id FROM SP_Idea__c LIMIT 1];

        Map<String, Object> result = SPIdeaController.voteForIdea('003000000000000', idea.Id, 'bad---token---123');
        System.assertEquals(false, result.get('success'));
    }

    // ─── Update Idea Status ─────────────────────────────────────

    @IsTest
    static void testUpdateIdeaStatus() {
        initSettings();
        String adminToken = getAdminToken();
        SP_Idea__c idea = [SELECT Id FROM SP_Idea__c LIMIT 1];

        Map<String, Object> result = SPIdeaController.updateIdeaStatus(idea.Id, 'Under Review', adminToken);
        System.assertEquals(true, result.get('success'), 'Status update should succeed');

        SP_Idea__c updated = [SELECT Status__c FROM SP_Idea__c WHERE Id = :idea.Id];
        System.assertEquals('Under Review', updated.Status__c);
    }

    @IsTest
    static void testUpdateIdeaStatusUnauthorized() {
        initSettings();
        String userToken = getUserToken();
        SP_Idea__c idea = [SELECT Id FROM SP_Idea__c LIMIT 1];

        Map<String, Object> result = SPIdeaController.updateIdeaStatus(idea.Id, 'Approved', userToken);
        System.assertEquals(false, result.get('success'), 'Regular user should be denied');
    }

    // ─── Toggle Published ─────────────────────────────────────

    @IsTest
    static void testToggleIdeaPublished() {
        initSettings();
        String adminToken = getAdminToken();
        SP_Idea__c idea = [SELECT Id, Published__c FROM SP_Idea__c LIMIT 1];

        // Unpublish
        Map<String, Object> result = SPIdeaController.toggleIdeaPublished(idea.Id, false, adminToken);
        System.assertEquals(true, result.get('success'), 'Toggle should succeed');

        SP_Idea__c updated = [SELECT Published__c FROM SP_Idea__c WHERE Id = :idea.Id];
        System.assertEquals(false, updated.Published__c, 'Should be unpublished');

        // Republish
        result = SPIdeaController.toggleIdeaPublished(idea.Id, true, adminToken);
        System.assertEquals(true, result.get('success'));

        updated = [SELECT Published__c FROM SP_Idea__c WHERE Id = :idea.Id];
        System.assertEquals(true, updated.Published__c, 'Should be republished');
    }

    @IsTest
    static void testToggleIdeaPublishedUnauthorized() {
        initSettings();
        String userToken = getUserToken();
        SP_Idea__c idea = [SELECT Id FROM SP_Idea__c LIMIT 1];

        Map<String, Object> result = SPIdeaController.toggleIdeaPublished(idea.Id, false, userToken);
        System.assertEquals(false, result.get('success'), 'Regular user should be denied');
    }

    @IsTest
    static void testGetIdeasHidesUnpublished() {
        initSettings();
        String userToken = getUserToken();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        // Unpublish one idea
        SP_Idea__c idea = [SELECT Id FROM SP_Idea__c LIMIT 1];
        idea.Published__c = false;
        update idea;

        Map<String, Object> result = SPIdeaController.getIdeas(user.Id, 'All', 1, userToken);
        System.assertEquals(true, result.get('success'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> ideas = (List<Object>) data.get('ideas');
        System.assertEquals(1, ideas.size(), 'Regular user should only see 1 published idea');
    }

    @IsTest
    static void testGetIdeasAdminSeesAll() {
        initSettings();
        String adminToken = getAdminToken();
        Contact admin = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.ADMIN_EMAIL LIMIT 1];

        // Unpublish one idea
        SP_Idea__c idea = [SELECT Id FROM SP_Idea__c LIMIT 1];
        idea.Published__c = false;
        update idea;

        Map<String, Object> result = SPIdeaController.getIdeas(admin.Id, 'All', 1, adminToken);
        System.assertEquals(true, result.get('success'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> ideas = (List<Object>) data.get('ideas');
        System.assertEquals(2, ideas.size(), 'Admin should see all ideas including unpublished');
    }

    // ─── Extension Constructor ──────────────────────────────────

    @IsTest
    static void testExtensionConstructor() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);
        SPAuthController auth = new SPAuthController();
        SPIdeaController ideaCtrl = new SPIdeaController(auth);
        System.assertNotEquals(null, ideaCtrl);
    }
}
