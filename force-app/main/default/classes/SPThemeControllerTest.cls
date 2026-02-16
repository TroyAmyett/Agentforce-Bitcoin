/**
 * @description Test class for SPThemeController - website fetching,
 * theme save/get/reset, CSS extraction, and favicon extraction.
 * @author Funnelists
 * @date 2026-02-10
 */
@IsTest
private class SPThemeControllerTest {

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

    // ─── Mock Callout for fetchWebsite ──────────────────────────

    private class MockWebsiteCallout implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);

            // Respond based on URL: CSS requests vs HTML requests
            if (req.getEndpoint().contains('.css')) {
                res.setBody('body { font-family: Inter; background: #ffffff; color: #333; }');
            } else {
                res.setBody(
                    '<html><head>'
                    + '<link rel="stylesheet" href="https://example.com/styles/main.css">'
                    + '<link rel="icon" href="/favicon.ico">'
                    + '</head><body>'
                    + '<header><img src="/logo.png" alt="Logo">Site Header</header>'
                    + '<footer>Site Footer</footer>'
                    + '</body></html>'
                );
            }
            return res;
        }
    }

    private class MockWebsiteCalloutError implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(500);
            res.setBody('Server Error');
            return res;
        }
    }

    // ─── Fetch Website ──────────────────────────────────────────

    @IsTest
    static void testFetchWebsiteSuccess() {
        initSettings();
        String adminToken = getAdminToken();

        Test.setMock(HttpCalloutMock.class, new MockWebsiteCallout());

        Test.startTest();
        Map<String, Object> result = SPThemeController.fetchWebsite('https://example.com', adminToken);
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Fetch should succeed: ' + result.get('error'));

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertNotEquals(null, data.get('html'), 'Should have HTML');
        System.assertNotEquals(null, data.get('cssUrls'), 'Should have CSS URLs');
        System.assertNotEquals(null, data.get('favicon'), 'Should have favicon');
    }

    @IsTest
    static void testFetchWebsiteAutoHttps() {
        initSettings();
        String adminToken = getAdminToken();

        Test.setMock(HttpCalloutMock.class, new MockWebsiteCallout());

        Test.startTest();
        Map<String, Object> result = SPThemeController.fetchWebsite('example.com', adminToken);
        Test.stopTest();

        System.assertEquals(true, result.get('success'), 'Should auto-add https: ' + result.get('error'));
    }

    @IsTest
    static void testFetchWebsiteHttpError() {
        initSettings();
        String adminToken = getAdminToken();

        Test.setMock(HttpCalloutMock.class, new MockWebsiteCalloutError());

        Test.startTest();
        Map<String, Object> result = SPThemeController.fetchWebsite('https://example.com', adminToken);
        Test.stopTest();

        System.assertEquals(false, result.get('success'), 'HTTP error should fail');
    }

    @IsTest
    static void testFetchWebsiteEmptyUrl() {
        initSettings();
        String adminToken = getAdminToken();

        Map<String, Object> result = SPThemeController.fetchWebsite('', adminToken);
        System.assertEquals(false, result.get('success'), 'Empty URL should fail');
    }

    @IsTest
    static void testFetchWebsiteUnauthorized() {
        initSettings();
        String userToken = getUserToken();

        Map<String, Object> result = SPThemeController.fetchWebsite('https://example.com', userToken);
        System.assertEquals(false, result.get('success'), 'Non-admin should be denied');
    }

    // ─── Save Theme ─────────────────────────────────────────────

    @IsTest
    static void testSaveTheme() {
        initSettings();
        String adminToken = getAdminToken();

        String themeJson = '{"primaryColor":"#ff0000","isDark":false}';
        Map<String, Object> result = SPThemeController.saveTheme(
            themeJson, 'https://example.com/newlogo.png', 'New Corp', 'https://newcorp.com', adminToken
        );
        System.assertEquals(true, result.get('success'), 'Save should succeed');

        // Verify it was saved
        SPUtils.cachedTheme = null;
        SP_Portal_Theme__c theme = SPUtils.getTheme();
        System.assertEquals('New Corp', theme.Company_Name__c);
    }

    @IsTest
    static void testSaveThemeCreatesDefault() {
        initSettings();
        String adminToken = getAdminToken();

        // Delete existing theme
        List<SP_Portal_Theme__c> themes = [SELECT Id FROM SP_Portal_Theme__c WHERE Name = 'Default'];
        if (!themes.isEmpty()) {
            delete themes;
        }
        SPUtils.cachedTheme = null;

        Map<String, Object> result = SPThemeController.saveTheme(
            '{}', '', 'Fresh', '', adminToken
        );
        System.assertEquals(true, result.get('success'), 'Should create Default theme');
    }

    @IsTest
    static void testSaveThemeUnauthorized() {
        initSettings();
        String userToken = getUserToken();

        Map<String, Object> result = SPThemeController.saveTheme('{}', '', '', '', userToken);
        System.assertEquals(false, result.get('success'), 'Non-admin should be denied');
    }

    // ─── Get Theme ──────────────────────────────────────────────

    @IsTest
    static void testGetTheme() {
        initSettings();
        Map<String, Object> result = SPThemeController.getTheme();
        System.assertEquals(true, result.get('success'), 'Get should succeed');

        Map<String, Object> data = (Map<String, Object>) result.get('data');
        System.assertEquals('Test Corp', data.get('companyName'));
    }

    // ─── Reset Theme ────────────────────────────────────────────

    @IsTest
    static void testResetTheme() {
        initSettings();
        String adminToken = getAdminToken();

        Map<String, Object> result = SPThemeController.resetTheme(adminToken);
        System.assertEquals(true, result.get('success'), 'Reset should succeed');

        // Verify fields are cleared
        SPUtils.cachedTheme = null;
        SP_Portal_Theme__c theme = SPUtils.getTheme();
        System.assertEquals(null, theme.Theme_JSON__c, 'Theme JSON should be null');
        System.assertEquals(null, theme.Logo_URL__c, 'Logo should be null');
    }

    @IsTest
    static void testResetThemeUnauthorized() {
        initSettings();
        String userToken = getUserToken();

        Map<String, Object> result = SPThemeController.resetTheme(userToken);
        System.assertEquals(false, result.get('success'));
    }

    @IsTest
    static void testResetThemeNoRecord() {
        initSettings();
        String adminToken = getAdminToken();

        // Delete theme
        List<SP_Portal_Theme__c> themes = [SELECT Id FROM SP_Portal_Theme__c WHERE Name = 'Default'];
        if (!themes.isEmpty()) {
            delete themes;
        }
        SPUtils.cachedTheme = null;

        Map<String, Object> result = SPThemeController.resetTheme(adminToken);
        System.assertEquals(true, result.get('success'), 'Should succeed even with no theme record');
    }

    // ─── CSS URL Extraction ─────────────────────────────────────

    @IsTest
    static void testExtractCssUrls() {
        String html = '<html><head>'
            + '<link rel="stylesheet" href="/css/main.css">'
            + '<link href="https://cdn.example.com/lib.css" rel="stylesheet">'
            + '<link rel="stylesheet" href="//fonts.googleapis.com/css?family=Inter">'
            + '<link rel="stylesheet" href="styles/local.css">'
            + '</head></html>';

        List<String> urls = SPThemeController.extractCssUrls(html, 'https://example.com');

        System.assert(urls.size() >= 3, 'Should find at least 3 CSS URLs, got: ' + urls.size());
        System.assert(urls.contains('https://example.com/css/main.css'), 'Should resolve relative /css/main.css');
        System.assert(urls.contains('https://cdn.example.com/lib.css'), 'Should keep absolute URL');
    }

    @IsTest
    static void testExtractCssUrlsEmpty() {
        List<String> urls = SPThemeController.extractCssUrls('', 'https://example.com');
        System.assertEquals(0, urls.size(), 'Empty HTML should return no URLs');

        urls = SPThemeController.extractCssUrls(null, 'https://example.com');
        System.assertEquals(0, urls.size(), 'Null HTML should return no URLs');
    }

    // ─── Favicon Extraction ─────────────────────────────────────

    @IsTest
    static void testExtractFavicon() {
        String html = '<html><head><link rel="icon" href="/images/favicon.ico"></head></html>';

        String favicon = SPThemeController.extractFavicon(html, 'https://example.com');
        System.assertEquals('https://example.com/images/favicon.ico', favicon);
    }

    @IsTest
    static void testExtractFaviconFallback() {
        String html = '<html><head></head></html>';

        String favicon = SPThemeController.extractFavicon(html, 'https://example.com');
        System.assertEquals('https://example.com/favicon.ico', favicon, 'Should fallback to /favicon.ico');
    }

    @IsTest
    static void testExtractFaviconEmpty() {
        String favicon = SPThemeController.extractFavicon('', 'https://example.com');
        System.assertEquals(null, favicon, 'Empty HTML should return null');
    }

    // ─── Extension Constructor ──────────────────────────────────

    @IsTest
    static void testExtensionConstructor() {
        initSettings();
        Test.setCurrentPage(Page.SPPortal);
        SPAuthController auth = new SPAuthController();
        SPThemeController themeCtrl = new SPThemeController(auth);
        System.assertNotEquals(null, themeCtrl);
    }
}
