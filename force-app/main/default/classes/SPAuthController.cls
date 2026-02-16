/**
 * @description Visualforce controller and RemoteAction provider for
 * the Support Portal. Serves as the controller for SPPortal.page and
 * exposes authentication endpoints for the React SPA via
 * Visualforce.remoting.
 *
 * Security: Uses `without sharing` because the Salesforce Sites guest user
 * has no record ownership context. Security is enforced via session validation
 * and role-based access control in individual RemoteAction methods. CRUD
 * checks are performed before all DML operations.
 *
 * @author Funnelists
 * @date 2026-02-06
 */
global without sharing class SPAuthController {

    // ─── VF Page Properties (read by SPPortal.page) ──────────────

    public Boolean sessionActive { get; private set; }
    public String userId { get; private set; }
    public String userName { get; private set; }
    public String userRole { get; private set; }
    public String portalName { get; private set; }
    public String brandColor { get; private set; }
    public String logoUrl { get; private set; }
    public Boolean agentforceEnabled { get; private set; }
    public String agentforceMode { get; private set; }
    public String agentforceScriptUrl { get; private set; }
    public String agentforceOrgId { get; private set; }
    public String agentforceDeploymentName { get; private set; }
    public String agentforceSiteUrl { get; private set; }
    public String agentforceScrtUrl { get; private set; }
    public String themeJson { get; private set; }
    public String companyName { get; private set; }
    public String supportEmail { get; private set; }
    public String supportPhone { get; private set; }
    public String registrationMode { get; private set; }
    public Boolean showAdminInPortal { get; private set; }
    public String faviconUrl { get; private set; }

    global SPAuthController() {
        sessionActive = false;
        userId = '';
        userName = '';
        userRole = 'User';
        agentforceEnabled = true;
        agentforceMode = 'builtin';
        agentforceScriptUrl = '';
        agentforceOrgId = '';
        agentforceDeploymentName = '';
        agentforceSiteUrl = '';
        agentforceScrtUrl = '';
        themeJson = '{}';
        companyName = '';
        logoUrl = '';
        faviconUrl = '';
        supportEmail = '';
        supportPhone = '';
        registrationMode = 'Account_Contact';
        showAdminInPortal = true;
    }

    /**
     * @description VF page action method. Checks for an existing session
     * and populates page properties for the React app to read.
     * @return null (no redirect)
     */
    global PageReference checkSession() {
        // Load settings
        Support_Portal__mdt settings = SPUtils.getSettings();
        agentforceEnabled = settings.Enable_Agentforce_Chat__c;
        supportEmail = settings.Support_Email__c;
        supportPhone = settings.Support_Phone__c;
        registrationMode = settings.Registration_Mode__c;
        showAdminInPortal = settings.Show_Admin_In_Portal__c != false;

        // Load theme
        SP_Portal_Theme__c theme = SPUtils.getTheme();
        themeJson = String.isNotBlank(theme.Theme_JSON__c) ? theme.Theme_JSON__c : '{}';
        companyName = theme.Company_Name__c;
        logoUrl = theme.Logo_URL__c;

        // Parse Agentforce config from portal config JSON
        if (String.isNotBlank(theme.Portal_Config_JSON__c)) {
            try {
                Map<String, Object> portalCfg = (Map<String, Object>) JSON.deserializeUntyped(theme.Portal_Config_JSON__c);
                Object afRaw = portalCfg.get('agentforce');
                if (afRaw != null) {
                    Map<String, Object> af = (Map<String, Object>) afRaw;
                    agentforceEnabled = af.get('enabled') == true;
                    String m = (String) af.get('mode');
                    agentforceMode = String.isNotBlank(m) ? m : 'builtin';
                    agentforceScriptUrl = (String) af.get('scriptUrl');
                    agentforceOrgId = (String) af.get('orgId');
                    agentforceDeploymentName = (String) af.get('deploymentName');
                    agentforceSiteUrl = (String) af.get('siteUrl');
                    agentforceScrtUrl = (String) af.get('scrtUrl');
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Failed to parse agentforce config: ' + e.getMessage());
            }
        }

        // Check for active session
        Contact user = SPUtils.validateSession();
        if (user != null) {
            sessionActive = true;
            userId = user.Id;
            userName = user.Name;
            userRole = user.SP_Role__c != null ? user.SP_Role__c : 'User';
        }

        return null;
    }

    // ─── RemoteAction: Login ─────────────────────────────────────

    /**
     * @description Authenticates a portal user by email and password.
     * Creates a session and sets the cookie on success.
     * @param email The username/email
     * @param password The plaintext password
     * @return Map with success status and user data or error
     */
    @RemoteAction
    global static Map<String, Object> login(String email, String password) {
        if (String.isBlank(email) || String.isBlank(password)) {
            return SPUtils.errorResponse('Email and password are required.');
        }

        Contact user = SPUtils.findUserByUsername(email.trim().toLowerCase());
        if (user == null) {
            return SPUtils.errorResponse('Invalid email or password.');
        }

        if (!SPUtils.validatePassword(password, user.SP_Password_Hash__c)) {
            return SPUtils.errorResponse('Invalid email or password.');
        }

        // Create session and get the token value for the client
        String sessionToken = '';
        try {
            Cookie sessionCookie = SPUtils.createSession(user.Id);
            sessionToken = sessionCookie.getValue();
            if (ApexPages.currentPage() != null) {
                ApexPages.currentPage().setCookies(new Cookie[]{ sessionCookie });
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Could not set session cookie during login: ' + e.getMessage());
        }

        // Update last login (CRUD check)
        SPUtils.assertUpdateable(Contact.sObjectType, 'Contact');
        user.SP_Last_Login__c = Datetime.now();
        update user;

        Map<String, Object> response = buildUserMap(user);
        response.put('sessionToken', sessionToken);
        return SPUtils.successResponse(response);
    }

    // ─── RemoteAction: Register ──────────────────────────────────

    /**
     * @description Registers a new portal user. Behavior is driven by
     * the Registration_Mode setting.
     * @param firstName First name
     * @param lastName Last name
     * @param email Email (becomes username)
     * @param password Plaintext password (will be hashed)
     * @param companyName Company name (used in Account_Contact mode)
     * @return Map with success status and user data or error
     */
    @RemoteAction
    global static Map<String, Object> register(
        String firstName, String lastName,
        String email, String password, String companyName
    ) {
        // Validate inputs
        if (String.isBlank(firstName) || String.isBlank(lastName) || String.isBlank(email)) {
            return SPUtils.errorResponse('First name, last name, and email are required.');
        }

        String passwordError = SPUtils.validatePasswordComplexity(password);
        if (passwordError != null) {
            return SPUtils.errorResponse(passwordError);
        }

        String normalizedEmail = email.trim().toLowerCase();

        // Check if username already taken
        Contact existing = SPUtils.findUserByUsername(normalizedEmail);
        if (existing != null) {
            return SPUtils.errorResponse('An account with this email already exists.');
        }

        Support_Portal__mdt settings = SPUtils.getSettings();
        String mode = settings.Registration_Mode__c;

        Contact newUser;
        try {
            if (mode == 'Self_Register') {
                newUser = registerSelfRegister(firstName, lastName, normalizedEmail, password, settings);
                if (newUser == null) {
                    // Domain didn't match any Account — tell user to call support
                    String phone = settings.Support_Phone__c;
                    String msg = 'We could not locate your company. Please call '
                        + (String.isNotBlank(phone) ? phone : 'our support team')
                        + ' to get set up.';
                    return SPUtils.errorResponse(msg);
                }
            } else if (mode == 'Invite_Only') {
                newUser = registerExistingOnly(firstName, lastName, normalizedEmail, password);
            } else if (mode == 'Account_Contact') {
                newUser = registerAccountContact(firstName, lastName, normalizedEmail, password, companyName, settings);
            } else if (mode == 'Person_Account') {
                return SPUtils.errorResponse('Person Account registration is not available in this org.');
            } else {
                // Existing_Only (legacy)
                newUser = registerExistingOnly(firstName, lastName, normalizedEmail, password);
            }
        } catch (Exception e) {
            return SPUtils.errorResponse('Registration failed: ' + e.getMessage());
        }

        if (newUser == null) {
            return SPUtils.errorResponse('Registration failed. Please contact support.');
        }

        // Send welcome email (best-effort, does not block registration)
        sendWelcomeEmail(newUser);

        // Create session for the new user
        String sessionToken = '';
        try {
            Cookie sessionCookie = SPUtils.createSession(newUser.Id);
            sessionToken = sessionCookie.getValue();
            if (ApexPages.currentPage() != null) {
                ApexPages.currentPage().setCookies(new Cookie[]{ sessionCookie });
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Could not set session cookie during registration: ' + e.getMessage());
            // Registration still succeeded - user can log in manually
        }

        Map<String, Object> response = buildUserMap(newUser);
        response.put('sessionToken', sessionToken);
        return SPUtils.successResponse(response);
    }

    // ─── RemoteAction: Logout ────────────────────────────────────

    /**
     * @description Logs out the current portal user by destroying their session.
     * @return Map with success status
     */
    @RemoteAction
    global static Map<String, Object> logout() {
        try {
            Cookie deadCookie = SPUtils.destroySession();
            if (ApexPages.currentPage() != null) {
                ApexPages.currentPage().setCookies(new Cookie[]{ deadCookie });
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Could not clear session cookie during logout: ' + e.getMessage());
        }
        return SPUtils.successResponse('Logged out successfully.');
    }

    // ─── RemoteAction: Get Current User ──────────────────────────

    /**
     * @description Returns the currently authenticated user's info
     * by validating the session cookie.
     * @return Map with user data or error
     */
    @RemoteAction
    global static Map<String, Object> getCurrentUser() {
        Contact user = SPUtils.validateSession();
        if (user == null) {
            return SPUtils.errorResponse('No active session.');
        }
        return SPUtils.successResponse(buildUserMap(user));
    }

    // ─── RemoteAction: Password Reset Request ────────────────────

    /**
     * @description Initiates a password reset by generating a token
     * and sending a reset email.
     * @param email The user's email/username
     * @return Map with success status (always returns success to prevent enumeration)
     */
    @RemoteAction
    global static Map<String, Object> resetPasswordRequest(String email) {
        if (String.isBlank(email)) {
            return SPUtils.errorResponse('Email is required.');
        }

        // Always return success to prevent email enumeration
        Contact user = SPUtils.findUserByUsername(email.trim().toLowerCase());
        if (user != null && String.isNotBlank(user.Email)) {
            SPUtils.assertUpdateable(Contact.sObjectType, 'Contact');
            String token = SPUtils.generateResetToken();
            user.SP_Reset_Token__c = token;
            user.SP_Reset_Token_Expiry__c = SPUtils.getResetTokenExpiry();
            update user;

            sendResetEmail(user, token);
        }

        return SPUtils.successResponse('If an account with that email exists, a reset link has been sent.');
    }

    // ─── RemoteAction: Reset Password ────────────────────────────

    /**
     * @description Resets a user's password using a valid token.
     * @param contactId The Contact Id
     * @param token The reset token from the email
     * @param newPassword The new password
     * @return Map with success status or error
     */
    @RemoteAction
    global static Map<String, Object> resetPassword(String contactId, String token, String newPassword) {
        if (String.isBlank(contactId) || String.isBlank(token) || String.isBlank(newPassword)) {
            return SPUtils.errorResponse('All fields are required.');
        }

        String passwordError = SPUtils.validatePasswordComplexity(newPassword);
        if (passwordError != null) {
            return SPUtils.errorResponse(passwordError);
        }

        List<Contact> users = [
            SELECT Id, SP_Reset_Token__c, SP_Reset_Token_Expiry__c
            FROM Contact
            WHERE Id = :contactId
            AND SP_Reset_Token__c = :token
            AND SP_Reset_Token_Expiry__c >= :Datetime.now()
            LIMIT 1
        ];

        if (users.isEmpty()) {
            return SPUtils.errorResponse('Invalid or expired reset token.');
        }

        SPUtils.assertUpdateable(Contact.sObjectType, 'Contact');
        Contact user = users[0];
        user.SP_Password_Hash__c = SPUtils.hashPassword(newPassword);
        user.SP_Reset_Token__c = null;
        user.SP_Reset_Token_Expiry__c = null;
        update user;

        return SPUtils.successResponse('Password has been reset. You can now log in.');
    }

    // ─── RemoteAction: Change Password ───────────────────────────

    /**
     * @description Changes the password for the authenticated user.
     * @param contactId The authenticated user's Contact Id
     * @param currentPassword The current password for verification
     * @param newPassword The new password
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> changePassword(String contactId, String currentPassword, String newPassword) {
        Contact user = SPUtils.getPortalUser(contactId);
        if (user == null) {
            return SPUtils.errorResponse('Invalid user session.');
        }

        if (!SPUtils.validatePassword(currentPassword, user.SP_Password_Hash__c)) {
            return SPUtils.errorResponse('Current password is incorrect.');
        }

        String passwordError = SPUtils.validatePasswordComplexity(newPassword);
        if (passwordError != null) {
            return SPUtils.errorResponse(passwordError);
        }

        SPUtils.assertUpdateable(Contact.sObjectType, 'Contact');
        user.SP_Password_Hash__c = SPUtils.hashPassword(newPassword);
        update user;

        return SPUtils.successResponse('Password changed successfully.');
    }

    // ─── Case Management Proxies ────────────────────────────────
    // VF remoting on Sites only resolves the page controller.
    // These thin delegates let the React SPA reach SPCaseController
    // methods through SPAuthController.

    @RemoteAction
    global static Map<String, Object> getCases(String contactId, String statusFilter, Integer pageNumber) {
        return SPCaseController.getCases(contactId, statusFilter, pageNumber);
    }

    @RemoteAction
    global static Map<String, Object> getCaseDetail(String contactId, String caseId) {
        return SPCaseController.getCaseDetail(contactId, caseId);
    }

    @RemoteAction
    global static Map<String, Object> createCase(String contactId, String subject, String description, String priority, String product, String caseType) {
        return SPCaseController.createCase(contactId, subject, description, priority, product, caseType);
    }

    @RemoteAction
    global static Map<String, Object> closeCase(String contactId, String caseId) {
        return SPCaseController.closeCase(contactId, caseId);
    }

    @RemoteAction
    global static Map<String, Object> addComment(String contactId, String caseId, String body) {
        return SPCaseController.addComment(contactId, caseId, body);
    }

    @RemoteAction
    global static Map<String, Object> uploadAttachment(String contactId, String caseId, String fileName, String base64Body) {
        return SPCaseController.uploadAttachment(contactId, caseId, fileName, base64Body);
    }

    @RemoteAction
    global static Map<String, Object> getAttachmentContent(String contactId, String contentDocumentId) {
        return SPCaseController.getAttachmentContent(contactId, contentDocumentId);
    }

    // ─── Theme Management Proxies ───────────────────────────────

    @RemoteAction
    global static Map<String, Object> fetchWebsite(String url, String sessionToken) {
        return SPThemeController.fetchWebsite(url, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> saveTheme(String themeJson, String logoUrl2, String companyName2, String sourceUrl, String sessionToken) {
        return SPThemeController.saveTheme(themeJson, logoUrl2, companyName2, sourceUrl, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> getTheme() {
        return SPThemeController.getTheme();
    }

    @RemoteAction
    global static Map<String, Object> resetTheme(String sessionToken) {
        return SPThemeController.resetTheme(sessionToken);
    }

    // ─── Admin Management Proxies ───────────────────────────────

    @RemoteAction
    global static Map<String, Object> getPortalUsers(Integer pageNumber, String searchTerm, String sessionToken) {
        return SPAdminController.getPortalUsers(pageNumber, searchTerm, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> updateUserStatus(String contactId, String status, String sessionToken) {
        return SPAdminController.updateUserStatus(contactId, status, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> updateUserRole(String contactId, String role, String sessionToken) {
        return SPAdminController.updateUserRole(contactId, role, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> getPortalStats(String sessionToken) {
        return SPAdminController.getPortalStats(sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> getPortalSettings(String sessionToken) {
        return SPAdminController.getPortalSettings(sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> savePortalSettings(String configJson, String sessionToken) {
        return SPAdminController.savePortalSettings(configJson, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> getPortalConfig() {
        SP_Portal_Theme__c theme = SPUtils.getTheme();
        return SPUtils.successResponse(new Map<String, Object>{
            'portalConfigJson' => theme.Portal_Config_JSON__c
        });
    }

    // ─── Ideas API Proxy ──────────────────────────────────────────

    @RemoteAction
    global static Map<String, Object> getIdeas(String contactId, String categoryFilter, Integer page, String sessionToken) {
        return SPIdeaController.getIdeas(contactId, categoryFilter, page, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> createIdea(String contactId, String title, String description, String category, String product, String sessionToken) {
        return SPIdeaController.createIdea(contactId, title, description, category, product, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> voteForIdea(String contactId, String ideaId, String sessionToken) {
        return SPIdeaController.voteForIdea(contactId, ideaId, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> updateIdeaStatus(String ideaId, String status, String sessionToken) {
        return SPIdeaController.updateIdeaStatus(ideaId, status, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> toggleIdeaPublished(String ideaId, Boolean published, String sessionToken) {
        return SPIdeaController.toggleIdeaPublished(ideaId, published, sessionToken);
    }

    // ─── AI API Proxy ─────────────────────────────────────────────

    @RemoteAction
    global static Map<String, Object> chat(String message, String conversationHistory, String sessionToken) {
        return SPAIController.chat(message, conversationHistory, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> generateFAQs(String documentText, String documentName, String sessionToken) {
        return SPAIController.generateFAQs(documentText, documentName, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> getFAQs(String sessionToken) {
        return SPAIController.getFAQs(sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> getAdminFAQs(String sessionToken) {
        return SPAIController.getAdminFAQs(sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> updateFAQ(String faqId, String question, String answer, String category, Boolean published, String sessionToken) {
        return SPAIController.updateFAQ(faqId, question, answer, category, published, sessionToken);
    }

    @RemoteAction
    global static Map<String, Object> deleteFAQ(String faqId, String sessionToken) {
        return SPAIController.deleteFAQ(faqId, sessionToken);
    }

    // ─── Private Registration Methods ────────────────────────────

    /**
     * @description Self-Register mode. Matches the user's email domain to an
     * existing Account via: (1) existing Contact with same domain, (2) Account
     * Website field. If no match, returns null and register() shows a
     * "call support" message.
     */
    private static Contact registerSelfRegister(
        String firstName, String lastName, String email,
        String password, Support_Portal__mdt settings
    ) {
        // Extract domain from email (e.g. bob@edge.com → edge.com)
        String domain = email.substringAfter('@').toLowerCase();

        Id matchedAccountId;

        // Priority 1: Find an existing Contact with the same email domain
        String domainPattern = '%@' + domain;
        List<Contact> domainContacts = [
            SELECT AccountId FROM Contact
            WHERE Email LIKE :domainPattern
            AND AccountId != null
            LIMIT 1
        ];
        if (!domainContacts.isEmpty()) {
            matchedAccountId = domainContacts[0].AccountId;
        }

        // Priority 2: Match Account Website field
        if (matchedAccountId == null) {
            String websitePattern = '%' + domain + '%';
            List<Account> websiteAccounts = [
                SELECT Id FROM Account
                WHERE Website LIKE :websitePattern
                LIMIT 1
            ];
            if (!websiteAccounts.isEmpty()) {
                matchedAccountId = websiteAccounts[0].Id;
            }
        }

        // No match — caller will return the "call support" error
        if (matchedAccountId == null) {
            return null;
        }

        // Create Contact on the matched Account
        SPUtils.assertCreateable(Contact.sObjectType, 'Contact');
        Contact con = new Contact(
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            AccountId = matchedAccountId,
            SP_Username__c = email,
            SP_Password_Hash__c = SPUtils.hashPassword(password),
            SP_Enabled__c = true,
            SP_Status__c = 'Active',
            SP_Role__c = 'User',
            SP_Registration_Date__c = Datetime.now()
        );
        if (String.isNotBlank(settings.Customer_Contact_RecordType__c)) {
            Map<String, Schema.RecordTypeInfo> rtMap =
                Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName();
            if (rtMap.containsKey(settings.Customer_Contact_RecordType__c)) {
                con.put('RecordTypeId', rtMap.get(settings.Customer_Contact_RecordType__c).getRecordTypeId());
            }
        }
        insert con;

        return SPUtils.getPortalUser(con.Id);
    }

    private static Contact registerAccountContact(
        String firstName, String lastName, String email,
        String password, String companyName, Support_Portal__mdt settings
    ) {
        // Find or create the Account
        Account acct;
        if (String.isNotBlank(companyName)) {
            List<Account> existing = [
                SELECT Id, Name FROM Account
                WHERE Name = :companyName
                LIMIT 1
            ];
            if (!existing.isEmpty()) {
                acct = existing[0];
            } else {
                SPUtils.assertCreateable(Account.sObjectType, 'Account');
                acct = new Account(Name = companyName);
                if (String.isNotBlank(settings.Customer_Account_RecordType__c)) {
                    Map<String, Schema.RecordTypeInfo> rtMap =
                        Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName();
                    if (rtMap.containsKey(settings.Customer_Account_RecordType__c)) {
                        acct.put('RecordTypeId', rtMap.get(settings.Customer_Account_RecordType__c).getRecordTypeId());
                    }
                }
                insert acct;
            }
        } else {
            // Default account for users without a company
            List<Account> defaults = [
                SELECT Id FROM Account
                WHERE Name = 'Portal Users'
                LIMIT 1
            ];
            if (!defaults.isEmpty()) {
                acct = defaults[0];
            } else {
                SPUtils.assertCreateable(Account.sObjectType, 'Account');
                acct = new Account(Name = 'Portal Users');
                insert acct;
            }
        }

        // Create Contact (CRUD check)
        SPUtils.assertCreateable(Contact.sObjectType, 'Contact');
        Contact con = new Contact(
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            AccountId = acct.Id,
            SP_Username__c = email,
            SP_Password_Hash__c = SPUtils.hashPassword(password),
            SP_Enabled__c = true,
            SP_Status__c = 'Active',
            SP_Role__c = 'User',
            SP_Registration_Date__c = Datetime.now()
        );
        if (String.isNotBlank(settings.Customer_Contact_RecordType__c)) {
            Map<String, Schema.RecordTypeInfo> rtMap =
                Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName();
            if (rtMap.containsKey(settings.Customer_Contact_RecordType__c)) {
                con.put('RecordTypeId', rtMap.get(settings.Customer_Contact_RecordType__c).getRecordTypeId());
            }
        }
        insert con;

        return SPUtils.getPortalUser(con.Id);
    }

    private static Contact registerExistingOnly(
        String firstName, String lastName, String email, String password
    ) {
        Contact existing = SPUtils.findContactByEmail(email);
        if (existing == null) {
            throw new SPException('No existing account found for this email. Please contact support.');
        }

        if (existing.SP_Enabled__c) {
            throw new SPException('An account with this email already exists.');
        }

        // Enable portal access on existing Contact (CRUD check)
        SPUtils.assertUpdateable(Contact.sObjectType, 'Contact');
        existing.SP_Username__c = email;
        existing.SP_Password_Hash__c = SPUtils.hashPassword(password);
        existing.SP_Enabled__c = true;
        existing.SP_Status__c = 'Active';
        existing.SP_Role__c = 'User';
        existing.SP_Registration_Date__c = Datetime.now();
        update existing;

        return SPUtils.getPortalUser(existing.Id);
    }

    // ─── Private Helpers ─────────────────────────────────────────

    private static Map<String, Object> buildUserMap(Contact user) {
        return new Map<String, Object>{
            'id' => user.Id,
            'firstName' => user.FirstName,
            'lastName' => user.LastName,
            'name' => user.Name,
            'email' => user.Email,
            'username' => user.SP_Username__c,
            'role' => user.SP_Role__c,
            'accountId' => user.AccountId,
            'accountName' => user.Account?.Name,
            'lastLogin' => user.SP_Last_Login__c
        };
    }

    private static void sendResetEmail(Contact user, String token) {
        try {
            // Build reset URL
            String baseUrl = Url.getOrgDomainUrl().toExternalForm();
            String sitePrefix = Site.getPathPrefix();
            if (String.isBlank(sitePrefix)) {
                sitePrefix = '';
            }
            String resetUrl = baseUrl + sitePrefix
                + '/SPPortal#/reset-password?id=' + user.Id + '&token=' + token;

            // Try to use the email template
            List<EmailTemplate> templates = [
                SELECT Id, HtmlValue, Subject
                FROM EmailTemplate
                WHERE DeveloperName = 'SP_Password_Reset'
                AND IsActive = true
                LIMIT 1
            ];

            String htmlBody;
            String subject;

            if (!templates.isEmpty() && String.isNotBlank(templates[0].HtmlValue)) {
                htmlBody = templates[0].HtmlValue;
                subject = String.isNotBlank(templates[0].Subject) ? templates[0].Subject : 'Password Reset Request';
                // Replace merge fields manually (template can't use setTemplateId due to dynamic URL)
                htmlBody = htmlBody.replace('{!Contact.FirstName}', user.FirstName != null ? user.FirstName : '');
                htmlBody = htmlBody.replace('{!Contact.LastName}', user.LastName != null ? user.LastName : '');
                htmlBody = htmlBody.replace('{!Contact.Name}', user.Name != null ? user.Name : '');
                htmlBody = htmlBody.replace('{!Contact.Email}', user.Email != null ? user.Email : '');
                htmlBody = htmlBody.replace('{{RESET_URL}}', resetUrl);
            } else {
                // Fallback: inline HTML when template is not deployed
                Support_Portal__mdt settings = SPUtils.getSettings();
                subject = 'Password Reset Request';
                htmlBody = '<p>A password reset was requested for your account.</p>'
                    + '<p>Click <a href="' + resetUrl + '">here</a> to reset your password.</p>'
                    + '<p>This link expires in 24 hours.</p>'
                    + '<p>If you did not request this, please ignore this email or contact '
                    + (String.isNotBlank(settings.Support_Email__c) ? settings.Support_Email__c : 'support')
                    + '.</p>';
            }

            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            Id oweaId = SPUtils.getOrgWideEmailAddressId();
            if (oweaId != null) {
                mail.setOrgWideEmailAddressId(oweaId);
            }
            mail.setToAddresses(new List<String>{ user.Email });
            mail.setSubject(subject);
            mail.setHtmlBody(htmlBody);
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail }, false);
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Failed to send reset email: ' + e.getMessage());
        }
    }

    /**
     * @description Sends a welcome email to a newly registered portal user.
     * Best-effort: failures are logged but do not block registration.
     * @param user The newly created/enabled Contact
     */
    private static void sendWelcomeEmail(Contact user) {
        Id templateId = SPUtils.getEmailTemplateId('SP_Welcome');
        if (templateId != null) {
            SPUtils.sendTemplateEmail(templateId, user.Id, null);
        }
    }

    global class SPException extends Exception {}
}
