/**
 * @description Test class for SPCaseController - Case CRUD, comments,
 * attachments, and access control.
 * @author Funnelists
 * @date 2026-02-10
 */
@IsTest
private class SPCaseControllerTest {

    @TestSetup
    static void setup() {
        Map<String, Object> env = SPTestDataFactory.setupFullEnvironment();
        Contact user = (Contact) env.get('user');
        SPTestDataFactory.createTestCase(user, 'Test Case 1', 'High');
        SPTestDataFactory.createTestCase(user, 'Test Case 2', 'Medium');
    }

    private static void initSettings() {
        SPTestDataFactory.setupSettingsCache();
        SPUtils.cachedTheme = null;
    }

    // ─── Get Cases ──────────────────────────────────────────────

    @IsTest
    static void testGetCasesSuccess() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.getCases(user.Id, null, 1);
        System.assertEquals(true, result.get('success'), 'Should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> cases = (List<Object>) data.get('cases');
        System.assert(cases.size() >= 2, 'Should have at least 2 cases');

        Map<String, Object> stats = (Map<String, Object>) data.get('stats');
        System.assertNotEquals(null, stats.get('open'), 'Stats should have open count');
    }

    @IsTest
    static void testGetCasesWithFilter() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> openResult = SPCaseController.getCases(user.Id, 'Open', 1);
        System.assertEquals(true, openResult.get('success'));

        Map<String, Object> closedResult = SPCaseController.getCases(user.Id, 'Closed', 1);
        System.assertEquals(true, closedResult.get('success'));
    }

    @IsTest
    static void testGetCasesCompanyWide() {
        SPUtils.cachedSettings = new Support_Portal__mdt(
            MasterLabel = 'Default',
            Case_Visibility__c = 'Company_Wide',
            Session_Duration_Minutes__c = 30
        );
        SPUtils.cachedTheme = null;
        Contact user = [SELECT Id, AccountId FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.getCases(user.Id, null, 1);
        System.assertEquals(true, result.get('success'), 'Company-wide should succeed');
    }

    @IsTest
    static void testGetCasesInvalidUser() {
        initSettings();
        Map<String, Object> result = SPCaseController.getCases('003000000000000', null, 1);
        System.assertEquals(false, result.get('success'), 'Invalid user should fail');
    }

    // ─── Get Case Detail ────────────────────────────────────────

    @IsTest
    static void testGetCaseDetail() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id LIMIT 1];

        Map<String, Object> result = SPCaseController.getCaseDetail(user.Id, testCase.Id);
        System.assertEquals(true, result.get('success'), 'Should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertNotEquals(null, data.get('case'), 'Should have case data');
        System.assertNotEquals(null, data.get('comments'), 'Should have comments list');
        System.assertNotEquals(null, data.get('attachments'), 'Should have attachments list');
    }

    @IsTest
    static void testGetCaseDetailNotFound() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.getCaseDetail(user.Id, '500000000000000');
        System.assertEquals(false, result.get('success'), 'Should fail for non-existent case');
    }

    @IsTest
    static void testGetCaseDetailCompanyWide() {
        SPUtils.cachedSettings = new Support_Portal__mdt(
            MasterLabel = 'Default',
            Case_Visibility__c = 'Company_Wide',
            Session_Duration_Minutes__c = 30
        );
        SPUtils.cachedTheme = null;
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id LIMIT 1];

        Map<String, Object> result = SPCaseController.getCaseDetail(user.Id, testCase.Id);
        System.assertEquals(true, result.get('success'));
    }

    // ─── Create Case ────────────────────────────────────────────

    @IsTest
    static void testCreateCase() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.createCase(
            user.Id, 'New Test Case', 'Description', 'High', 'Radar', 'Problem'
        );
        System.assertEquals(true, result.get('success'), 'Create should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertEquals('New Test Case', data.get('subject'));
    }

    @IsTest
    static void testCreateCaseDefaultPriority() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.createCase(
            user.Id, 'Default Priority Case', 'Desc', null, null, null
        );
        System.assertEquals(true, result.get('success'));
    }

    @IsTest
    static void testCreateCaseEmptySubject() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.createCase(user.Id, '', 'Desc', 'Medium', null, null);
        System.assertEquals(false, result.get('success'), 'Empty subject should fail');
    }

    @IsTest
    static void testCreateCaseInvalidUser() {
        initSettings();
        Map<String, Object> result = SPCaseController.createCase(
            '003000000000000', 'Subject', 'Desc', 'Medium', null, null
        );
        System.assertEquals(false, result.get('success'));
    }

    // ─── Close Case ─────────────────────────────────────────────

    @IsTest
    static void testCloseCase() {
        initSettings();
        Contact user = [SELECT Id, Email FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id AND IsClosed = false LIMIT 1];

        Map<String, Object> result = SPCaseController.closeCase(user.Id, testCase.Id);
        System.assertEquals(true, result.get('success'), 'Close should succeed');

        // Verify case is closed
        Case closed = [SELECT IsClosed FROM Case WHERE Id = :testCase.Id];
        System.assertEquals(true, closed.IsClosed, 'Case should be closed');
    }

    @IsTest
    static void testCloseCaseAlreadyClosed() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id LIMIT 1];

        // Close it first
        testCase.Status = 'Closed';
        update testCase;

        Map<String, Object> result = SPCaseController.closeCase(user.Id, testCase.Id);
        System.assertEquals(false, result.get('success'), 'Already closed should fail');
    }

    @IsTest
    static void testCloseCaseNotFound() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.closeCase(user.Id, '500000000000000');
        System.assertEquals(false, result.get('success'));
    }

    // ─── Add Comment ────────────────────────────────────────────

    @IsTest
    static void testAddComment() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id LIMIT 1];

        Map<String, Object> result = SPCaseController.addComment(user.Id, testCase.Id, 'Test comment');
        System.assertEquals(true, result.get('success'), 'Comment should succeed');
    }

    @IsTest
    static void testAddCommentEmpty() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id LIMIT 1];

        Map<String, Object> result = SPCaseController.addComment(user.Id, testCase.Id, '');
        System.assertEquals(false, result.get('success'), 'Empty body should fail');
    }

    @IsTest
    static void testAddCommentAccessDenied() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.addComment(user.Id, '500000000000000', 'Comment');
        System.assertEquals(false, result.get('success'), 'Non-existent case should fail');
    }

    // ─── Upload Attachment ──────────────────────────────────────

    @IsTest
    static void testUploadAttachment() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id LIMIT 1];

        String base64Content = EncodingUtil.base64Encode(Blob.valueOf('Test file content'));

        Map<String, Object> result = SPCaseController.uploadAttachment(
            user.Id, testCase.Id, 'test.txt', base64Content
        );
        System.assertEquals(true, result.get('success'), 'Upload should succeed');
    }

    @IsTest
    static void testUploadAttachmentEmpty() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id LIMIT 1];

        Map<String, Object> result = SPCaseController.uploadAttachment(user.Id, testCase.Id, '', '');
        System.assertEquals(false, result.get('success'), 'Empty file should fail');
    }

    // ─── Get Attachment Content ─────────────────────────────────

    @IsTest
    static void testGetAttachmentContent() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];
        Case testCase = [SELECT Id FROM Case WHERE ContactId = :user.Id LIMIT 1];

        // Create a ContentVersion
        ContentVersion cv = new ContentVersion(
            Title = 'TestFile',
            PathOnClient = 'TestFile.txt',
            VersionData = Blob.valueOf('File contents here'),
            FirstPublishLocationId = testCase.Id
        );
        insert cv;

        // Get the ContentDocumentId
        cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];

        Map<String, Object> result = SPCaseController.getAttachmentContent(user.Id, cv.ContentDocumentId);
        System.assertEquals(true, result.get('success'), 'Should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertEquals('TestFile', data.get('title'));
        System.assertNotEquals(null, data.get('base64Data'));
    }

    @IsTest
    static void testGetAttachmentContentEmpty() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.getAttachmentContent(user.Id, '');
        System.assertEquals(false, result.get('success'), 'Empty ID should fail');
    }

    @IsTest
    static void testGetAttachmentContentNotFound() {
        initSettings();
        Contact user = [SELECT Id FROM Contact WHERE SP_Username__c = :SPTestDataFactory.TEST_EMAIL LIMIT 1];

        Map<String, Object> result = SPCaseController.getAttachmentContent(user.Id, '069000000000000');
        System.assertEquals(false, result.get('success'), 'Nonexistent doc should fail');
    }

    // ─── Extension Constructor ──────────────────────────────────

    @IsTest
    static void testExtensionConstructor() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);
        SPAuthController auth = new SPAuthController();
        SPCaseController caseCtrl = new SPCaseController(auth);
        System.assertNotEquals(null, caseCtrl);
    }
}
