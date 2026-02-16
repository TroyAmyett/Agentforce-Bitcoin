/**
 * @description RemoteAction controller for the Website Theme Extraction
 * feature. Provides an Apex HTTP proxy to fetch website HTML/CSS
 * (bypassing browser CORS restrictions) and saves extracted themes.
 *
 * Security: Uses `without sharing` because the Salesforce Sites guest user
 * has no record ownership; security is enforced via role-based access control
 * requiring Super Admin role in all mutating methods. CRUD checks are
 * performed before all DML operations.
 *
 * @author Funnelists
 * @date 2026-02-06
 */
global without sharing class SPThemeController {

    // Extension constructor for VF page (required for remoting on Sites)
    global SPThemeController(SPAuthController controller) {}

    private static final Integer MAX_CSS_FILES = 10;
    private static final Integer HTTP_TIMEOUT = 15000; // 15 seconds

    // ─── Fetch Website for Theme Extraction ──────────────────────

    /**
     * @description Fetches a website's HTML and CSS files via HTTP callout.
     * Acts as a CORS proxy so the React SPA can parse the content
     * client-side for theme extraction.
     * @param url The website URL to fetch
     * @return Map with html content, css contents array, and metadata
     */
    @RemoteAction
    global static Map<String, Object> fetchWebsite(String url, String sessionToken) {
        if (String.isBlank(url)) {
            return SPUtils.errorResponse('URL is required.');
        }

        // Verify caller is Super Admin (read-only: no DML before callouts)
        Contact user = SPUtils.validateSessionReadOnly(sessionToken);
        if (user == null || user.SP_Role__c != 'Super Admin') {
            return SPUtils.errorResponse('Super Admin access required.');
        }

        // Normalize URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        // SSRF protection: block requests to internal Salesforce/localhost domains
        String lowerUrl = url.toLowerCase();
        if (lowerUrl.contains('.salesforce.com') || lowerUrl.contains('.force.com')
            || lowerUrl.contains('localhost') || lowerUrl.contains('127.0.0.1')
            || lowerUrl.contains('0.0.0.0') || lowerUrl.contains('[::1]')) {
            return SPUtils.errorResponse('Cannot fetch internal or reserved URLs.');
        }

        try {
            // Fetch the HTML
            HttpRequest req = new HttpRequest();
            req.setEndpoint(url);
            req.setMethod('GET');
            req.setTimeout(HTTP_TIMEOUT);
            req.setHeader('User-Agent', 'Mozilla/5.0 (compatible; SupportPortal/1.0)');

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() != 200) {
                return SPUtils.errorResponse('Failed to fetch website. HTTP ' + res.getStatusCode());
            }

            String html = res.getBody();

            // Extract CSS file URLs from HTML
            List<String> cssUrls = extractCssUrls(html, url);

            // Fetch each CSS file
            List<String> cssContents = new List<String>();
            Integer fetched = 0;
            for (String cssUrl : cssUrls) {
                if (fetched >= MAX_CSS_FILES) break;
                try {
                    HttpRequest cssReq = new HttpRequest();
                    cssReq.setEndpoint(cssUrl);
                    cssReq.setMethod('GET');
                    cssReq.setTimeout(HTTP_TIMEOUT);
                    cssReq.setHeader('User-Agent', 'Mozilla/5.0 (compatible; SupportPortal/1.0)');

                    HttpResponse cssRes = http.send(cssReq);
                    if (cssRes.getStatusCode() == 200) {
                        cssContents.add(cssRes.getBody());
                        fetched++;
                    }
                } catch (Exception e) {
                    // Skip failed CSS files
                    continue;
                }
            }

            // Extract favicon
            String favicon = extractFavicon(html, url);

            return SPUtils.successResponse(new Map<String, Object>{
                'html' => html,
                'cssContents' => cssContents,
                'cssUrls' => cssUrls,
                'favicon' => favicon,
                'sourceUrl' => url
            });

        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to fetch website: ' + e.getMessage());
        }
    }

    // ─── Save Theme ──────────────────────────────────────────────

    /**
     * @description Saves the extracted and customized theme to the
     * SP_Portal_Theme__c hierarchy custom setting.
     * @param themeJson JSON string of the theme configuration
     * @param logoUrl URL of the extracted/uploaded logo
     * @param companyName Company name for branding
     * @param sourceUrl The website URL the theme was extracted from
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> saveTheme(
        String themeJson, String logoUrl, String companyName, String sourceUrl, String sessionToken
    ) {
        // Verify caller is Super Admin
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null || user.SP_Role__c != 'Super Admin') {
            return SPUtils.errorResponse('Super Admin access required.');
        }

        try {
            List<SP_Portal_Theme__c> themes = [
                SELECT Id, Name FROM SP_Portal_Theme__c
                WHERE Name = 'Default' LIMIT 1
            ];
            SP_Portal_Theme__c theme;
            if (themes.isEmpty()) {
                SPUtils.assertCreateable(SP_Portal_Theme__c.sObjectType, 'Theme');
                theme = new SP_Portal_Theme__c(Name = 'Default');
            } else {
                SPUtils.assertUpdateable(SP_Portal_Theme__c.sObjectType, 'Theme');
                theme = themes[0];
            }

            theme.Theme_JSON__c = themeJson;
            theme.Logo_URL__c = logoUrl;
            theme.Company_Name__c = companyName;
            theme.Source_Website_URL__c = sourceUrl;

            upsert theme;

            // Clear cached theme so next page load picks up the change
            SPUtils.cachedTheme = null;

            return SPUtils.successResponse('Theme saved successfully.');
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to save theme: ' + e.getMessage());
        }
    }

    // ─── Reset Theme to Defaults ────────────────────────────────

    /**
     * @description Resets the theme to defaults by clearing all
     * saved theme data from SP_Portal_Theme__c.
     * @param sessionToken Session token for auth
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> resetTheme(String sessionToken) {
        // Verify caller is Super Admin
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null || user.SP_Role__c != 'Super Admin') {
            return SPUtils.errorResponse('Super Admin access required.');
        }

        try {
            List<SP_Portal_Theme__c> themes = [
                SELECT Id FROM SP_Portal_Theme__c
                WHERE Name = 'Default' LIMIT 1
            ];

            if (!themes.isEmpty()) {
                SPUtils.assertUpdateable(SP_Portal_Theme__c.sObjectType, 'Theme');
                SP_Portal_Theme__c theme = themes[0];
                theme.Theme_JSON__c = null;
                theme.Logo_URL__c = null;
                theme.Company_Name__c = null;
                theme.Source_Website_URL__c = null;
                update theme;
            }

            // Clear cached theme
            SPUtils.cachedTheme = null;

            return SPUtils.successResponse('Theme reset to defaults.');
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to reset theme: ' + e.getMessage());
        }
    }

    // ─── Get Current Theme ───────────────────────────────────────

    /**
     * @description Returns the current theme configuration.
     * @return Map with theme data
     */
    @RemoteAction
    global static Map<String, Object> getTheme() {
        SP_Portal_Theme__c theme = SPUtils.getTheme();
        return SPUtils.successResponse(new Map<String, Object>{
            'themeJson' => theme.Theme_JSON__c,
            'logoUrl' => theme.Logo_URL__c,
            'companyName' => theme.Company_Name__c,
            'sourceUrl' => theme.Source_Website_URL__c
        });
    }

    // ─── Private Helpers ─────────────────────────────────────────

    /**
     * @description Extracts CSS stylesheet URLs from HTML content.
     * Resolves relative URLs to absolute using the base URL.
     */
    @TestVisible
    private static List<String> extractCssUrls(String html, String baseUrl) {
        List<String> cssUrls = new List<String>();
        if (String.isBlank(html)) return cssUrls;

        // Parse base domain for relative URL resolution
        String baseDomain = '';
        try {
            Url parsedUrl = new Url(baseUrl);
            baseDomain = parsedUrl.getProtocol() + '://' + parsedUrl.getHost();
        } catch (Exception e) {
            return cssUrls;
        }

        // Find <link rel="stylesheet" href="...">
        // Simple regex-based extraction
        Pattern linkPattern = Pattern.compile(
            '<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']'
        );
        Matcher m = linkPattern.matcher(html);
        while (m.find()) {
            String href = m.group(1);
            cssUrls.add(resolveUrl(href, baseDomain, baseUrl));
        }

        // Also check reversed attribute order: href before rel
        Pattern linkPattern2 = Pattern.compile(
            '<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']stylesheet["\']'
        );
        Matcher m2 = linkPattern2.matcher(html);
        while (m2.find()) {
            String href = m2.group(1);
            String resolved = resolveUrl(href, baseDomain, baseUrl);
            if (!cssUrls.contains(resolved)) {
                cssUrls.add(resolved);
            }
        }

        return cssUrls;
    }

    /**
     * @description Extracts the favicon URL from HTML content.
     */
    @TestVisible
    private static String extractFavicon(String html, String baseUrl) {
        if (String.isBlank(html)) return null;

        String baseDomain = '';
        try {
            Url parsedUrl = new Url(baseUrl);
            baseDomain = parsedUrl.getProtocol() + '://' + parsedUrl.getHost();
        } catch (Exception e) {
            return null;
        }

        // Find <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
        Pattern iconPattern = Pattern.compile(
            '<link[^>]+rel=["\'](?:shortcut )?icon["\'][^>]+href=["\']([^"\']+)["\']'
        );
        Matcher m = iconPattern.matcher(html);
        if (m.find()) {
            return resolveUrl(m.group(1), baseDomain, baseUrl);
        }

        // Fallback: try /favicon.ico
        return baseDomain + '/favicon.ico';
    }

    /**
     * @description Resolves a potentially relative URL to absolute.
     */
    private static String resolveUrl(String href, String baseDomain, String baseUrl) {
        if (href.startsWith('http://') || href.startsWith('https://')) {
            return href;
        } else if (href.startsWith('//')) {
            return 'https:' + href;
        } else if (href.startsWith('/')) {
            return baseDomain + href;
        } else {
            // Relative path
            String basePath = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
            return basePath + href;
        }
    }
}
