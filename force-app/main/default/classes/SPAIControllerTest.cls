/**
 * @description Test class for SPAIController - AI chat, FAQ generation,
 * FAQ CRUD, and multi-provider LLM callouts.
 * @author Funnelists
 * @date 2026-02-11
 */
@IsTest
private class SPAIControllerTest {

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

    /**
     * Sets Portal_Config_JSON__c with AI config for the given provider.
     */
    private static void setAIConfig(String provider) {
        SP_Portal_Theme__c theme = [SELECT Id, Portal_Config_JSON__c FROM SP_Portal_Theme__c WHERE Name = 'Default' LIMIT 1];
        Map<String, Object> config = new Map<String, Object>{
            'showProduct' => true,
            'productOptions' => 'Radar,Canvas',
            'ai' => new Map<String, Object>{
                'provider' => provider,
                'apiKey' => 'test-api-key-12345',
                'model' => provider == 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5-20250929',
                'systemPrompt' => 'You are a test assistant.',
                'maxTokens' => 512
            }
        };
        theme.Portal_Config_JSON__c = JSON.serialize(config);
        update theme;
        SPUtils.cachedTheme = null;
    }

    // ─── Mock Callouts ──────────────────────────────────────────

    private class MockClaudeCallout implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setHeader('Content-Type', 'application/json');
            res.setBody('{"id":"msg_123","type":"message","role":"assistant","content":[{"type":"text","text":"Hello! I can help with that. Let me check our knowledge base for you."}],"model":"claude-sonnet-4-5-20250929","stop_reason":"end_turn"}');
            return res;
        }
    }

    private class MockOpenAICallout implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setHeader('Content-Type', 'application/json');
            res.setBody('{"id":"chatcmpl-123","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"I can help you with that question. Here is what I found."},"finish_reason":"stop"}]}');
            return res;
        }
    }

    private class MockFAQGenerationCallout implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setHeader('Content-Type', 'application/json');

            String faqJson = '[{"question":"How do I get started?","answer":"Sign up and follow the onboarding guide.","category":"Getting Started"},{"question":"How do I reset my password?","answer":"Click Forgot Password on the login page.","category":"Account & Settings"},{"question":"What products are available?","answer":"We offer Radar, Canvas, and AgentPM.","category":"Products & Features"}]';

            // Wrap in Claude response format
            res.setBody('{"id":"msg_456","type":"message","role":"assistant","content":[{"type":"text","text":' + JSON.serialize(faqJson) + '}],"model":"claude-sonnet-4-5-20250929","stop_reason":"end_turn"}');
            return res;
        }
    }

    private class MockCalloutError implements HttpCalloutMock {
        private Integer statusCode;

        MockCalloutError(Integer code) {
            this.statusCode = code;
        }

        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(statusCode);
            res.setBody('{"error":{"message":"Unauthorized"}}');
            return res;
        }
    }

    // ─── Chat Tests ─────────────────────────────────────────────

    @IsTest
    static void testChatWithClaude() {
        initSettings();
        setAIConfig('claude');
        String userToken = getUserToken();

        Test.setMock(HttpCalloutMock.class, new MockClaudeCallout());

        Test.startTest();
        Map<String, Object> result = SPAIController.chat('How do I create a case?', null, userToken);
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Chat should succeed: ' + result.get('error'));
        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertNotEquals(null, data.get('reply'), 'Should have reply');
        System.assert(((String) data.get('reply')).contains('Hello'), 'Reply should contain response text');
    }

    @IsTest
    static void testChatWithOpenAI() {
        initSettings();
        setAIConfig('openai');
        String userToken = getUserToken();

        Test.setMock(HttpCalloutMock.class, new MockOpenAICallout());

        Test.startTest();
        Map<String, Object> result = SPAIController.chat('Help me with an issue', null, userToken);
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Chat should succeed: ' + result.get('error'));
        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assert(((String) data.get('reply')).contains('help'), 'Should have OpenAI response');
    }

    @IsTest
    static void testChatWithConversationHistory() {
        initSettings();
        setAIConfig('claude');
        String userToken = getUserToken();

        Test.setMock(HttpCalloutMock.class, new MockClaudeCallout());

        String history = '[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi there!"}]';

        Test.startTest();
        Map<String, Object> result = SPAIController.chat('Follow up question', history, userToken);
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Chat with history should succeed');
    }

    @IsTest
    static void testChatEmptyMessage() {
        initSettings();
        String userToken = getUserToken();

        Map<String, Object> result = SPAIController.chat('', null, userToken);
        System.assertEquals(false, result.get('success'), 'Empty message should fail');
    }

    @IsTest
    static void testChatInvalidSession() {
        initSettings();
        Map<String, Object> result = SPAIController.chat('Hello', null, 'invalid-token');
        System.assertEquals(false, result.get('success'), 'Invalid session should fail');
    }

    @IsTest
    static void testChatNoAIConfig() {
        initSettings();
        String userToken = getUserToken();

        // Don't set AI config — Portal_Config_JSON__c has no 'ai' key
        Map<String, Object> result = SPAIController.chat('Hello', null, userToken);
        System.assertEquals(false, result.get('success'), 'No AI config should fail');
        System.assert(((String) result.get('error')).contains('not configured'), 'Should mention configuration');
    }

    @IsTest
    static void testChatApiKeyError() {
        initSettings();
        setAIConfig('claude');
        String userToken = getUserToken();

        Test.setMock(HttpCalloutMock.class, new MockCalloutError(401));

        Test.startTest();
        Map<String, Object> result = SPAIController.chat('Hello', null, userToken);
        Test.stopTest();

        System.assertEquals(false, result.get('success'), 'Invalid API key should fail');
        System.assert(((String) result.get('error')).contains('API key'), 'Should mention API key');
    }

    @IsTest
    static void testChatRateLimit() {
        initSettings();
        setAIConfig('claude');
        String userToken = getUserToken();

        Test.setMock(HttpCalloutMock.class, new MockCalloutError(429));

        Test.startTest();
        Map<String, Object> result = SPAIController.chat('Hello', null, userToken);
        Test.stopTest();

        System.assertEquals(false, result.get('success'), 'Rate limit should fail');
        System.assert(((String) result.get('error')).contains('Rate limit'), 'Should mention rate limit');
    }

    // ─── Generate FAQs Tests ────────────────────────────────────

    @IsTest
    static void testGenerateFAQs() {
        initSettings();
        setAIConfig('claude');
        String adminToken = getAdminToken();

        Test.setMock(HttpCalloutMock.class, new MockFAQGenerationCallout());

        Test.startTest();
        Map<String, Object> result = SPAIController.generateFAQs(
            'Our product Radar helps with deployment management. Canvas is for funnel building.',
            'Product Overview',
            adminToken
        );
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Generate should succeed: ' + result.get('error'));
        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> faqs = (List<Object>) data.get('faqs');
        System.assert(faqs.size() >= 2, 'Should generate at least 2 FAQs, got: ' + faqs.size());
        System.assertEquals(faqs.size(), (Integer) data.get('count'), 'Count should match FAQ list size');

        // Verify records were created
        List<SP_FAQ__c> created = [SELECT Id, Published__c, Source_Document__c FROM SP_FAQ__c];
        System.assert(created.size() >= 2, 'Should have created FAQ records');
        System.assertEquals(false, created[0].Published__c, 'FAQs should be drafts');
        System.assertEquals('Product Overview', created[0].Source_Document__c);
    }

    @IsTest
    static void testGenerateFAQsNonAdmin() {
        initSettings();
        setAIConfig('claude');
        String userToken = getUserToken();

        Map<String, Object> result = SPAIController.generateFAQs('Some text', 'Doc', userToken);
        System.assertEquals(false, result.get('success'), 'Non-admin should be denied');
    }

    @IsTest
    static void testGenerateFAQsEmptyText() {
        initSettings();
        String adminToken = getAdminToken();

        Map<String, Object> result = SPAIController.generateFAQs('', 'Doc', adminToken);
        System.assertEquals(false, result.get('success'), 'Empty text should fail');
    }

    // ─── Get FAQs Tests ─────────────────────────────────────────

    @IsTest
    static void testGetFAQs() {
        initSettings();
        String userToken = getUserToken();

        // Create some test FAQs
        insert new List<SP_FAQ__c>{
            new SP_FAQ__c(Question__c = 'Q1', Answer__c = 'A1', Category__c = 'Getting Started', Sort_Order__c = 1, Published__c = true),
            new SP_FAQ__c(Question__c = 'Q2', Answer__c = 'A2', Category__c = 'Troubleshooting', Sort_Order__c = 1, Published__c = true),
            new SP_FAQ__c(Question__c = 'Draft Q', Answer__c = 'Draft A', Category__c = 'Other', Sort_Order__c = 1, Published__c = false)
        };

        Map<String, Object> result = SPAIController.getFAQs(userToken);
        System.assertEquals(true, result.get('success'), 'Get should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> faqs = (List<Object>) data.get('faqs');
        System.assertEquals(2, faqs.size(), 'Should only return published FAQs');
    }

    @IsTest
    static void testGetFAQsInvalidSession() {
        initSettings();
        Map<String, Object> result = SPAIController.getFAQs('invalid');
        System.assertEquals(false, result.get('success'));
    }

    // ─── Get Admin FAQs Tests ───────────────────────────────────

    @IsTest
    static void testGetAdminFAQs() {
        initSettings();
        String adminToken = getAdminToken();

        insert new List<SP_FAQ__c>{
            new SP_FAQ__c(Question__c = 'Q1', Answer__c = 'A1', Category__c = 'Getting Started', Published__c = true),
            new SP_FAQ__c(Question__c = 'Draft', Answer__c = 'A2', Category__c = 'Other', Published__c = false)
        };

        Map<String, Object> result = SPAIController.getAdminFAQs(adminToken);
        System.assertEquals(true, result.get('success'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        List<Object> faqs = (List<Object>) data.get('faqs');
        System.assertEquals(2, faqs.size(), 'Admin should see all FAQs including drafts');
    }

    @IsTest
    static void testGetAdminFAQsNonAdmin() {
        initSettings();
        String userToken = getUserToken();

        Map<String, Object> result = SPAIController.getAdminFAQs(userToken);
        System.assertEquals(false, result.get('success'));
    }

    // ─── Update FAQ Tests ───────────────────────────────────────

    @IsTest
    static void testUpdateFAQ() {
        initSettings();
        String adminToken = getAdminToken();

        SP_FAQ__c faq = new SP_FAQ__c(
            Question__c = 'Original Q', Answer__c = 'Original A',
            Category__c = 'Other', Published__c = false
        );
        insert faq;

        Map<String, Object> result = SPAIController.updateFAQ(
            faq.Id, 'Updated Q', 'Updated A', 'Troubleshooting', true, adminToken
        );
        System.assertEquals(true, result.get('success'), 'Update should succeed');

        SP_FAQ__c updated = [SELECT Question__c, Answer__c, Category__c, Published__c FROM SP_FAQ__c WHERE Id = :faq.Id];
        System.assertEquals('Updated Q', updated.Question__c);
        System.assertEquals('Updated A', updated.Answer__c);
        System.assertEquals('Troubleshooting', updated.Category__c);
        System.assertEquals(true, updated.Published__c);
    }

    @IsTest
    static void testUpdateFAQNotFound() {
        initSettings();
        String adminToken = getAdminToken();

        // Use a fake but valid-format Id
        String fakeId = SP_FAQ__c.sObjectType.getDescribe().getKeyPrefix() + '000000000000';
        Map<String, Object> result = SPAIController.updateFAQ(fakeId, 'Q', 'A', 'Other', true, adminToken);
        System.assertEquals(false, result.get('success'));
    }

    @IsTest
    static void testUpdateFAQNonAdmin() {
        initSettings();
        String userToken = getUserToken();

        SP_FAQ__c faq = new SP_FAQ__c(Question__c = 'Q', Answer__c = 'A', Category__c = 'Other');
        insert faq;

        Map<String, Object> result = SPAIController.updateFAQ(faq.Id, 'New Q', 'New A', 'Other', true, userToken);
        System.assertEquals(false, result.get('success'));
    }

    // ─── Delete FAQ Tests ───────────────────────────────────────

    @IsTest
    static void testDeleteFAQ() {
        initSettings();
        String adminToken = getAdminToken();

        SP_FAQ__c faq = new SP_FAQ__c(Question__c = 'Delete me', Answer__c = 'Bye', Category__c = 'Other');
        insert faq;

        Map<String, Object> result = SPAIController.deleteFAQ(faq.Id, adminToken);
        System.assertEquals(true, result.get('success'), 'Delete should succeed');

        List<SP_FAQ__c> remaining = [SELECT Id FROM SP_FAQ__c WHERE Id = :faq.Id];
        System.assertEquals(0, remaining.size(), 'FAQ should be deleted');
    }

    @IsTest
    static void testDeleteFAQNotFound() {
        initSettings();
        String adminToken = getAdminToken();

        String fakeId = SP_FAQ__c.sObjectType.getDescribe().getKeyPrefix() + '000000000000';
        Map<String, Object> result = SPAIController.deleteFAQ(fakeId, adminToken);
        System.assertEquals(false, result.get('success'));
    }

    @IsTest
    static void testDeleteFAQNonAdmin() {
        initSettings();
        String userToken = getUserToken();

        SP_FAQ__c faq = new SP_FAQ__c(Question__c = 'Q', Answer__c = 'A', Category__c = 'Other');
        insert faq;

        Map<String, Object> result = SPAIController.deleteFAQ(faq.Id, userToken);
        System.assertEquals(false, result.get('success'));
    }

    // ─── JSON Parsing Tests ─────────────────────────────────────

    @IsTest
    static void testParseJsonArrayDirect() {
        String json = '[{"question":"Q1","answer":"A1","category":"Other"}]';
        List<Object> result = SPAIController.parseJsonArray(json);
        System.assertNotEquals(null, result);
        System.assertEquals(1, result.size());
    }

    @IsTest
    static void testParseJsonArrayInMarkdown() {
        String wrapped = 'Here are the FAQs:\n```json\n[{"question":"Q1","answer":"A1","category":"Other"}]\n```';
        List<Object> result = SPAIController.parseJsonArray(wrapped);
        System.assertNotEquals(null, result);
        System.assertEquals(1, result.size());
    }

    @IsTest
    static void testParseJsonArrayEmpty() {
        System.assertEquals(null, SPAIController.parseJsonArray(null));
        System.assertEquals(null, SPAIController.parseJsonArray(''));
        System.assertEquals(null, SPAIController.parseJsonArray('no json here'));
    }

    // ─── AI Config Parsing ──────────────────────────────────────

    @IsTest
    static void testGetAIConfigPresent() {
        initSettings();
        setAIConfig('claude');

        Map<String, Object> config = SPAIController.getAIConfig();
        System.assertNotEquals(null, config);
        System.assertEquals('claude', config.get('provider'));
        System.assertEquals('test-api-key-12345', config.get('apiKey'));
    }

    @IsTest
    static void testGetAIConfigMissing() {
        initSettings();
        // Don't set AI config
        Map<String, Object> config = SPAIController.getAIConfig();
        System.assertEquals(null, config, 'Should return null when no AI config');
    }

    // ─── Extension Constructor ──────────────────────────────────

    @IsTest
    static void testExtensionConstructor() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);
        SPAuthController auth = new SPAuthController();
        SPAIController aiCtrl = new SPAIController(auth);
        System.assertNotEquals(null, aiCtrl);
    }
}
