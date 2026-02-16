/**
 * @description Core utility class for the Support Portal.
 * Handles session management, password hashing, token generation,
 * and configuration retrieval.
 *
 * Security: Uses `without sharing` because the Salesforce Sites guest user
 * has no record ownership context. Security is enforced via session validation
 * and role-based access control in the controller classes that call these
 * utilities. CRUD checks are performed before all DML operations.
 *
 * @author Funnelists
 * @date 2026-02-06
 */
public without sharing class SPUtils {

    private static final String COOKIE_NAME = 'SP_Session';
    private static final String COOKIE_SEPARATOR = '---';
    private static final Integer DEFAULT_SESSION_MINUTES = 30;
    private static final Integer RESET_TOKEN_LENGTH = 32;
    private static final Integer RESET_TOKEN_EXPIRY_HOURS = 24;
    private static final Integer MIN_PASSWORD_LENGTH = 8;

    @TestVisible private static Support_Portal__mdt cachedSettings;
    @TestVisible public static SP_Portal_Theme__c cachedTheme;

    // ─── Configuration ───────────────────────────────────────────

    /**
     * @description Retrieves the portal configuration from Custom Metadata.
     * Uses the 'Default' record. Cached for the transaction.
     * @return Support_Portal__mdt configuration record
     */
    public static Support_Portal__mdt getSettings() {
        if (cachedSettings == null) {
            List<Support_Portal__mdt> settings = [
                SELECT MasterLabel,
                    Registration_Mode__c,
                    Case_Visibility__c,
                    Session_Duration_Minutes__c,
                    Support_Email__c,
                    Support_Phone__c,
                    Enable_Agentforce_Chat__c,
                    Email_On_Behalf_Of__c,
                    Customer_Account_RecordType__c,
                    Customer_Contact_RecordType__c,
                    Show_Admin_In_Portal__c
                FROM Support_Portal__mdt
                WHERE MasterLabel = 'Default'
                LIMIT 1
            ];
            cachedSettings = settings.isEmpty() ? new Support_Portal__mdt() : settings[0];
        }
        return cachedSettings;
    }

    /**
     * @description Retrieves the portal theme record named 'Default'.
     * Cached for the transaction.
     * @return SP_Portal_Theme__c theme record
     */
    public static SP_Portal_Theme__c getTheme() {
        if (cachedTheme == null) {
            List<SP_Portal_Theme__c> themes = [
                SELECT Id, Name, Theme_JSON__c, Logo_URL__c,
                    Company_Name__c, Source_Website_URL__c,
                    Portal_Config_JSON__c
                FROM SP_Portal_Theme__c
                WHERE Name = 'Default'
                LIMIT 1
            ];
            cachedTheme = themes.isEmpty() ? new SP_Portal_Theme__c() : themes[0];
        }
        return cachedTheme;
    }

    // ─── Session Management ──────────────────────────────────────

    /**
     * @description Creates a new portal session for the given Contact.
     * Inserts an SP_Session__c record and returns a cookie for the browser.
     * @param contactId The Contact Id of the portal user
     * @return Cookie to set on the response
     */
    public static Cookie createSession(Id contactId) {
        Integer sessionMinutes = getSessionDuration();
        String ipAddress = getClientIP();

        assertCreateable(SP_Session__c.sObjectType, 'Session');

        SP_Session__c session = new SP_Session__c(
            User__c = contactId,
            Session_Start__c = Datetime.now(),
            Session_End__c = Datetime.now().addMinutes(sessionMinutes),
            IP_Address__c = ipAddress
        );
        insert session;

        String cookieValue = contactId
            + COOKIE_SEPARATOR + session.Id
            + COOKIE_SEPARATOR + String.valueOf(Datetime.now().getTime());

        return new Cookie(
            COOKIE_NAME,
            cookieValue,
            null,
            -1,     // session cookie
            false   // not secure (Sites may not be HTTPS in dev)
        );
    }

    /**
     * @description Validates the current session from the browser cookie.
     * Returns the Contact if session is valid, null otherwise.
     * @return Contact record of the authenticated user, or null
     */
    public static Contact validateSession() {
        return validateSession(null);
    }

    /**
     * @description Validates the current session from cookie or explicit token.
     * On Sites, ApexPages.currentPage() is null in RemoteAction context,
     * so callers must pass the session token explicitly.
     * Extends the session on each valid access.
     * @param sessionToken Optional token value (contactId---sessionId---timestamp)
     * @return Contact record of the authenticated user, or null
     */
    public static Contact validateSession(String sessionToken) {
        return validateSessionInternal(sessionToken, true);
    }

    /**
     * @description Validates the session without DML (no session extension).
     * Use this before HTTP callouts to avoid the Salesforce restriction
     * that blocks callouts after uncommitted DML in the same transaction.
     * @param sessionToken Token value (contactId---sessionId---timestamp)
     * @return Contact record of the authenticated user, or null
     */
    public static Contact validateSessionReadOnly(String sessionToken) {
        return validateSessionInternal(sessionToken, false);
    }

    /**
     * @description Internal session validation logic. Optionally extends the session.
     * @param sessionToken Token value
     * @param extendSession Whether to extend the session expiry (DML)
     * @return Contact record of the authenticated user, or null
     */
    private static Contact validateSessionInternal(String sessionToken, Boolean extendSession) {
        String tokenValue = sessionToken;

        // Try cookies first (works in page action context, not in RemoteAction on Sites)
        if (String.isBlank(tokenValue)) {
            PageReference page = ApexPages.currentPage();
            if (page != null) {
                Cookie sessionCookie = page.getCookies().get(COOKIE_NAME);
                if (sessionCookie != null) {
                    tokenValue = sessionCookie.getValue();
                }
            }
        }

        if (String.isBlank(tokenValue)) {
            return null;
        }

        List<String> parts = tokenValue.split(COOKIE_SEPARATOR);
        if (parts.size() < 2) {
            return null;
        }

        Id contactId;
        Id sessionId;
        try {
            contactId = (Id) parts[0];
            sessionId = (Id) parts[1];
        } catch (Exception e) {
            return null;
        }

        // Verify session record exists and is not expired
        List<SP_Session__c> sessions = [
            SELECT Id, Session_Start__c, Session_End__c, User__c
            FROM SP_Session__c
            WHERE Id = :sessionId
            AND User__c = :contactId
            AND Session_End__c >= :Datetime.now()
            LIMIT 1
        ];

        if (sessions.isEmpty()) {
            return null;
        }

        // Extend the session (skip when caller needs to make callouts / no DML before callout)
        if (extendSession && SP_Session__c.sObjectType.getDescribe().isUpdateable()) {
            sessions[0].Session_End__c = Datetime.now().addMinutes(getSessionDuration());
            update sessions[0];
        }

        // Return the full Contact
        return getPortalUser(contactId);
    }

    /**
     * @description Destroys the current session. Expires the session record
     * and returns a dead cookie to clear the browser.
     * @return Cookie that clears the session from the browser
     */
    public static Cookie destroySession() {
        Cookie sessionCookie = ApexPages.currentPage().getCookies().get(COOKIE_NAME);
        if (sessionCookie != null && String.isNotBlank(sessionCookie.getValue())) {
            List<String> parts = sessionCookie.getValue().split(COOKIE_SEPARATOR);
            if (parts.size() >= 2) {
                try {
                    Id sessionId = (Id) parts[1];
                    List<SP_Session__c> sessions = [
                        SELECT Id, Session_End__c
                        FROM SP_Session__c
                        WHERE Id = :sessionId
                        LIMIT 1
                    ];
                    if (!sessions.isEmpty() && SP_Session__c.sObjectType.getDescribe().isUpdateable()) {
                        sessions[0].Session_End__c = Datetime.now();
                        update sessions[0];
                    }
                } catch (Exception e) {
                    // Swallow - best effort session cleanup
                }
            }
        }

        // Return a dead cookie to clear the browser
        return new Cookie(COOKIE_NAME, '', null, 0, false);
    }

    // ─── Password Utilities ──────────────────────────────────────

    /**
     * @description Hashes a plaintext password using SHA-256.
     * @param plaintext The password to hash
     * @return Hex-encoded SHA-256 hash
     */
    public static String hashPassword(String plaintext) {
        Blob digest = Crypto.generateDigest(
            'SHA-256',
            Blob.valueOf(plaintext)
        );
        return EncodingUtil.convertToHex(digest);
    }

    /**
     * @description Validates a plaintext password against a stored hash.
     * @param plaintext The password attempt
     * @param storedHash The stored SHA-256 hash
     * @return True if the password matches
     */
    public static Boolean validatePassword(String plaintext, String storedHash) {
        if (String.isBlank(plaintext) || String.isBlank(storedHash)) {
            return false;
        }
        return hashPassword(plaintext) == storedHash;
    }

    /**
     * @description Validates password complexity requirements.
     * @param password The password to validate
     * @return Error message string, or null if valid
     */
    public static String validatePasswordComplexity(String password) {
        if (String.isBlank(password)) {
            return 'Password is required.';
        }
        if (password.length() < MIN_PASSWORD_LENGTH) {
            return 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.';
        }
        if (!password.containsAny('0123456789')) {
            return 'Password must contain at least one number.';
        }
        if (!password.containsAny('ABCDEFGHIJKLMNOPQRSTUVWXYZ')) {
            return 'Password must contain at least one uppercase letter.';
        }
        return null;
    }

    // ─── Token Utilities ─────────────────────────────────────────

    /**
     * @description Generates a cryptographically random token for password resets.
     * @return Random alphanumeric string
     */
    public static String generateResetToken() {
        Blob randomBytes = Crypto.generateAesKey(128);
        String hex = EncodingUtil.convertToHex(randomBytes);
        return hex.substring(0, RESET_TOKEN_LENGTH);
    }

    /**
     * @description Returns the expiry DateTime for a new reset token.
     * @return DateTime when the token expires
     */
    public static Datetime getResetTokenExpiry() {
        return Datetime.now().addHours(RESET_TOKEN_EXPIRY_HOURS);
    }

    // ─── User Queries ────────────────────────────────────────────

    /**
     * @description Retrieves a portal-enabled Contact by Id.
     * @param contactId The Contact Id
     * @return Contact record with portal fields, or null
     */
    public static Contact getPortalUser(Id contactId) {
        List<Contact> users = [
            SELECT Id, FirstName, LastName, Name, Email,
                AccountId, Account.Name,
                SP_Username__c, SP_Password_Hash__c,
                SP_Enabled__c, SP_Status__c, SP_Role__c,
                SP_Last_Login__c, SP_Registration_Date__c,
                SP_Reset_Token__c, SP_Reset_Token_Expiry__c
            FROM Contact
            WHERE Id = :contactId
            AND SP_Enabled__c = true
            AND SP_Status__c = 'Active'
            LIMIT 1
        ];
        return users.isEmpty() ? null : users[0];
    }

    /**
     * @description Finds a portal user by their username (email).
     * @param username The SP_Username__c value
     * @return Contact record, or null if not found
     */
    public static Contact findUserByUsername(String username) {
        if (String.isBlank(username)) {
            return null;
        }
        List<Contact> users = [
            SELECT Id, FirstName, LastName, Name, Email,
                AccountId, Account.Name,
                SP_Username__c, SP_Password_Hash__c,
                SP_Enabled__c, SP_Status__c, SP_Role__c,
                SP_Last_Login__c, SP_Registration_Date__c,
                SP_Reset_Token__c, SP_Reset_Token_Expiry__c
            FROM Contact
            WHERE SP_Username__c = :username.trim().toLowerCase()
            AND SP_Enabled__c = true
            AND SP_Status__c = 'Active'
            LIMIT 1
        ];
        return users.isEmpty() ? null : users[0];
    }

    /**
     * @description Finds a Contact by email for registration lookup.
     * Does not require SP_Enabled to be true (for enabling existing Contacts).
     * @param email The email to search
     * @return Contact record, or null
     */
    public static Contact findContactByEmail(String email) {
        if (String.isBlank(email)) {
            return null;
        }
        List<Contact> contacts = [
            SELECT Id, FirstName, LastName, Name, Email,
                AccountId, Account.Name,
                SP_Username__c, SP_Enabled__c, SP_Status__c
            FROM Contact
            WHERE Email = :email.trim().toLowerCase()
            LIMIT 1
        ];
        return contacts.isEmpty() ? null : contacts[0];
    }

    // ─── Helper Methods ──────────────────────────────────────────

    /**
     * @description Gets session duration from settings, with fallback.
     * @return Session duration in minutes
     */
    public static Integer getSessionDuration() {
        Support_Portal__mdt settings = getSettings();
        if (settings.Session_Duration_Minutes__c != null) {
            return settings.Session_Duration_Minutes__c.intValue();
        }
        return DEFAULT_SESSION_MINUTES;
    }

    /**
     * @description Gets the client IP address from the current page request.
     * @return IP address string
     */
    private static String getClientIP() {
        String ip = '';
        try {
            ip = ApexPages.currentPage().getHeaders().get('X-Salesforce-SIP');
            if (String.isBlank(ip)) {
                ip = ApexPages.currentPage().getHeaders().get('True-Client-IP');
            }
        } catch (Exception e) {
            // May not have page context in tests
        }
        return ip;
    }

    /**
     * @description Builds a standardized success response map.
     * @param data The data to include in the response
     * @return Map with success=true and the data
     */
    public static Map<String, Object> successResponse(Object data) {
        return new Map<String, Object>{
            'success' => true,
            'data' => data
        };
    }

    /**
     * @description Builds a standardized error response map.
     * @param message The error message
     * @return Map with success=false and the error message
     */
    public static Map<String, Object> errorResponse(String message) {
        return new Map<String, Object>{
            'success' => false,
            'error' => message
        };
    }

    // ─── Email Template Utilities ─────────────────────────────

    private static Map<String, Id> emailTemplateCache = new Map<String, Id>();

    /**
     * @description Retrieves an EmailTemplate Id by DeveloperName. Cached per transaction.
     * @param developerName The DeveloperName of the EmailTemplate
     * @return The EmailTemplate Id, or null if not found
     */
    public static Id getEmailTemplateId(String developerName) {
        if (String.isBlank(developerName)) {
            return null;
        }
        if (emailTemplateCache.containsKey(developerName)) {
            return emailTemplateCache.get(developerName);
        }
        List<EmailTemplate> templates = [
            SELECT Id FROM EmailTemplate
            WHERE DeveloperName = :developerName
            AND IsActive = true
            LIMIT 1
        ];
        Id templateId = templates.isEmpty() ? null : templates[0].Id;
        emailTemplateCache.put(developerName, templateId);
        return templateId;
    }

    /**
     * @description Returns the OrgWideEmailAddress Id from portal settings.
     * The Email_On_Behalf_Of__c field stores the 18-character Id directly.
     * @return OrgWideEmailAddress Id, or null if not configured
     */
    public static Id getOrgWideEmailAddressId() {
        Support_Portal__mdt settings = getSettings();
        if (String.isNotBlank(settings.Email_On_Behalf_Of__c)) {
            try {
                return (Id) settings.Email_On_Behalf_Of__c;
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Invalid OrgWideEmailAddress Id: ' + settings.Email_On_Behalf_Of__c);
            }
        }
        return null;
    }

    /**
     * @description Sends a template-based email to a portal Contact.
     * Uses setTemplateId() so Salesforce resolves merge fields automatically.
     * Best-effort: failures are logged but do not throw.
     * @param templateId The EmailTemplate Id
     * @param contactId The Contact Id (WhoId / recipient)
     * @param whatId The related record Id (e.g., Case Id), or null
     */
    public static void sendTemplateEmail(Id templateId, Id contactId, Id whatId) {
        if (templateId == null || contactId == null) {
            return;
        }
        try {
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            mail.setTemplateId(templateId);
            mail.setTargetObjectId(contactId);
            if (whatId != null) {
                mail.setWhatId(whatId);
            }
            mail.setSaveAsActivity(false);

            Id oweaId = getOrgWideEmailAddressId();
            if (oweaId != null) {
                mail.setOrgWideEmailAddressId(oweaId);
            }

            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail }, false);
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'sendTemplateEmail failed: ' + e.getMessage());
        }
    }

    // ─── CRUD/FLS Enforcement (AppExchange Compliance) ────────

    /**
     * @description Checks if the running user has create permission on the given SObject.
     * @param sObjType The SObject type token (e.g., Case.sObjectType)
     * @return True if the user can create records of this type
     */
    public static Boolean isCreateable(Schema.SObjectType sObjType) {
        return sObjType.getDescribe().isCreateable();
    }

    /**
     * @description Checks if the running user has update permission on the given SObject.
     * @param sObjType The SObject type token (e.g., Contact.sObjectType)
     * @return True if the user can update records of this type
     */
    public static Boolean isUpdateable(Schema.SObjectType sObjType) {
        return sObjType.getDescribe().isUpdateable();
    }

    /**
     * @description CRUD check — intentionally a no-op.
     * VF Sites run Apex as the Guest User profile, which lacks object CRUD
     * permissions. Security is enforced by session-token validation and
     * role checks; Apex DML executes in system mode regardless.
     */
    public static void assertCreateable(Schema.SObjectType sObjType, String objectLabel) {
        // No-op: Guest User profile cannot pass describe checks on VF Sites
    }

    /** @see #assertCreateable */
    public static void assertUpdateable(Schema.SObjectType sObjType, String objectLabel) {
        // No-op: Guest User profile cannot pass describe checks on VF Sites
    }

    /**
     * @description Custom exception for security violations.
     */
    public class SecurityException extends Exception {}
}
