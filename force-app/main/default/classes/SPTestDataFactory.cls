/**
 * @description Shared test data factory for Support Portal test classes.
 * Creates Account, Contact, Session, Theme, and Case records
 * needed by all controller tests.
 *
 * @author Funnelists
 * @date 2026-02-10
 */
@IsTest
public class SPTestDataFactory {

    public static final String TEST_PASSWORD = 'Test1234!';
    public static final String TEST_EMAIL = 'testuser@sp-test.com';
    public static final String ADMIN_EMAIL = 'admin@sp-test.com';

    /**
     * Creates a standard test Account.
     */
    public static Account createAccount(String name) {
        Account acct = new Account(Name = name);
        insert acct;
        return acct;
    }

    /**
     * Creates a portal-enabled Contact with the given role.
     */
    public static Contact createPortalContact(Account acct, String firstName, String lastName,
            String email, String role) {
        String passwordHash = SPUtils.hashPassword(TEST_PASSWORD);
        Contact con = new Contact(
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            AccountId = acct.Id,
            SP_Username__c = email,
            SP_Password_Hash__c = passwordHash,
            SP_Enabled__c = true,
            SP_Status__c = 'Active',
            SP_Role__c = role,
            SP_Registration_Date__c = Datetime.now()
        );
        insert con;
        return con;
    }

    /**
     * Creates a test session for the given Contact.
     * Returns the session token string.
     */
    public static String createTestSession(Contact con) {
        SP_Session__c session = new SP_Session__c(
            User__c = con.Id,
            Session_Start__c = Datetime.now(),
            Session_End__c = Datetime.now().addMinutes(30)
        );
        insert session;
        return con.Id + '---' + session.Id + '---' + String.valueOf(Datetime.now().getTime());
    }

    /**
     * Creates a Default portal theme record.
     */
    public static SP_Portal_Theme__c createDefaultTheme() {
        SP_Portal_Theme__c theme = new SP_Portal_Theme__c(
            Name = 'Default',
            Company_Name__c = 'Test Corp',
            Logo_URL__c = 'https://example.com/logo.png',
            Theme_JSON__c = '{"primaryColor":"#2563eb","isDark":false}',
            Source_Website_URL__c = 'https://example.com',
            Portal_Config_JSON__c = '{"showProduct":true,"productOptions":"Radar,Canvas","showPriority":true,"showType":false,"showAdminInPortal":true}'
        );
        insert theme;
        return theme;
    }

    /**
     * Creates a test Case associated with the given Contact.
     */
    public static Case createTestCase(Contact con, String subject, String priority) {
        Case c = new Case(
            ContactId = con.Id,
            AccountId = con.AccountId,
            Subject = subject,
            Description = 'Test case description for ' + subject,
            Priority = priority,
            Origin = 'Support Portal',
            Status = 'New'
        );
        insert c;
        return c;
    }

    /**
     * Creates a test SP_Idea__c record.
     */
    public static SP_Idea__c createTestIdea(Contact con, String title, String category) {
        SP_Idea__c idea = new SP_Idea__c(
            Title__c = title,
            Description__c = 'Test idea description',
            Category__c = category,
            Status__c = 'New',
            Vote_Count__c = 1,
            Voted_Contact_Ids__c = con.Id,
            Contact__c = con.Id,
            Account__c = con.AccountId
        );
        insert idea;
        return idea;
    }

    /**
     * Sets up the Custom Metadata mock via @TestVisible cached field.
     */
    public static void setupSettingsCache() {
        Support_Portal__mdt settings = new Support_Portal__mdt(
            MasterLabel = 'Default',
            Registration_Mode__c = 'Account_Contact',
            Case_Visibility__c = 'User_Only',
            Session_Duration_Minutes__c = 30,
            Support_Email__c = 'support@test.com',
            Support_Phone__c = '555-0100',
            Enable_Agentforce_Chat__c = true,
            Show_Admin_In_Portal__c = true
        );
        SPUtils.cachedSettings = settings;
    }

    /**
     * Sets up a complete test environment:
     * - Custom metadata cache
     * - Account + Super Admin + Regular User
     * - Default theme
     * Returns a map with all created records.
     */
    public static Map<String, Object> setupFullEnvironment() {
        setupSettingsCache();

        Account acct = createAccount('Test Company');
        Contact admin = createPortalContact(acct, 'Admin', 'User', ADMIN_EMAIL, 'Super Admin');
        Contact user = createPortalContact(acct, 'Regular', 'User', TEST_EMAIL, 'User');
        SP_Portal_Theme__c theme = createDefaultTheme();

        String adminToken = createTestSession(admin);
        String userToken = createTestSession(user);

        return new Map<String, Object>{
            'account' => acct,
            'admin' => admin,
            'user' => user,
            'theme' => theme,
            'adminToken' => adminToken,
            'userToken' => userToken
        };
    }
}
