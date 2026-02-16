/**
 * @description RemoteAction controller for Portal Admin functions.
 * User management, role assignment, and portal statistics.
 * All methods require Super Admin or Portal Admin role.
 *
 * Security: Uses `without sharing` because the Salesforce Sites guest user
 * has no record ownership; security is enforced via role-based access
 * control in method entry points. CRUD checks are performed before all
 * DML operations.
 *
 * @author Funnelists
 * @date 2026-02-06
 */
global without sharing class SPAdminController {

    // Extension constructor for VF page (required for remoting on Sites)
    global SPAdminController(SPAuthController controller) {}

    private static final Integer PAGE_SIZE = 25;

    // ─── Get Portal Users ────────────────────────────────────────

    /**
     * @description Returns a paginated list of portal users.
     * @param pageNumber Page number (1-based)
     * @param searchTerm Optional search filter on name/email
     * @return Map with user list and pagination info
     */
    @RemoteAction
    global static Map<String, Object> getPortalUsers(Integer pageNumber, String searchTerm, String sessionToken) {
        try {
            Contact admin = SPUtils.validateSession(sessionToken);
            if (admin == null || (admin.SP_Role__c != 'Super Admin' && admin.SP_Role__c != 'Portal Admin')) {
                return SPUtils.errorResponse('Admin access required.');
            }

            Integer pg = (pageNumber != null && pageNumber > 0) ? pageNumber : 1;
            Integer offset = (pg - 1) * PAGE_SIZE;

            String baseQuery = 'SELECT Id, FirstName, LastName, Name, Email, '
                + 'SP_Username__c, SP_Enabled__c, SP_Status__c, SP_Role__c, '
                + 'SP_Last_Login__c, SP_Registration_Date__c, Account.Name '
                + 'FROM Contact WHERE SP_Username__c != null ';

            String countBase = 'SELECT COUNT() FROM Contact WHERE SP_Username__c != null ';

            String searchBind;
            if (String.isNotBlank(searchTerm)) {
                searchBind = '%' + searchTerm.trim() + '%';
                String filter = 'AND (Name LIKE :searchBind OR SP_Username__c LIKE :searchBind) ';
                baseQuery += filter;
                countBase += filter;
            }

            Integer totalRecords = Database.countQuery(countBase);

            baseQuery += 'ORDER BY SP_Registration_Date__c DESC NULLS LAST '
                + 'LIMIT ' + PAGE_SIZE + ' OFFSET ' + offset;

            List<Contact> users = Database.query(baseQuery);

            List<Map<String, Object>> userList = new List<Map<String, Object>>();
            for (Contact c : users) {
                userList.add(new Map<String, Object>{
                    'id' => c.Id,
                    'firstName' => c.FirstName,
                    'lastName' => c.LastName,
                    'name' => c.Name,
                    'email' => c.Email,
                    'username' => c.SP_Username__c,
                    'enabled' => c.SP_Enabled__c,
                    'status' => c.SP_Status__c,
                    'role' => c.SP_Role__c,
                    'lastLogin' => c.SP_Last_Login__c,
                    'registrationDate' => c.SP_Registration_Date__c,
                    'accountName' => c.Account?.Name
                });
            }

            return SPUtils.successResponse(new Map<String, Object>{
                'users' => userList,
                'totalRecords' => totalRecords,
                'pageSize' => PAGE_SIZE,
                'currentPage' => pg,
                'totalPages' => (Integer) Math.ceil((Decimal) totalRecords / PAGE_SIZE)
            });
        } catch (Exception e) {
            return SPUtils.errorResponse('Server error: ' + e.getMessage() + ' [' + e.getStackTraceString() + ']');
        }
    }

    // ─── Update User Status ──────────────────────────────────────

    /**
     * @description Enables or disables a portal user.
     * @param contactId The Contact Id to update
     * @param status The new status ('Active', 'Inactive', 'Pending')
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> updateUserStatus(String contactId, String status, String sessionToken) {
        Contact admin = SPUtils.validateSession(sessionToken);
        if (admin == null || (admin.SP_Role__c != 'Super Admin' && admin.SP_Role__c != 'Portal Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        List<Contact> users = [
            SELECT Id, SP_Status__c, SP_Enabled__c
            FROM Contact WHERE Id = :contactId LIMIT 1
        ];

        if (users.isEmpty()) {
            return SPUtils.errorResponse('User not found.');
        }

        SPUtils.assertUpdateable(Contact.sObjectType, 'Contact');
        Contact user = users[0];
        user.SP_Status__c = status;
        user.SP_Enabled__c = (status == 'Active');
        update user;

        return SPUtils.successResponse('User status updated to ' + status + '.');
    }

    // ─── Update User Role ────────────────────────────────────────

    /**
     * @description Changes a portal user's role.
     * Only Super Admin can assign Super Admin role.
     * @param contactId The Contact Id to update
     * @param role The new role ('User', 'Portal Admin', 'Super Admin')
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> updateUserRole(String contactId, String role, String sessionToken) {
        Contact admin = SPUtils.validateSession(sessionToken);
        if (admin == null) {
            return SPUtils.errorResponse('Invalid session.');
        }

        // Only Super Admin can grant Super Admin
        if (role == 'Super Admin' && admin.SP_Role__c != 'Super Admin') {
            return SPUtils.errorResponse('Only Super Admins can assign the Super Admin role.');
        }

        // Portal Admin can only manage Users
        if (admin.SP_Role__c == 'Portal Admin' && role == 'Portal Admin') {
            return SPUtils.errorResponse('Portal Admins cannot create other Portal Admins.');
        }

        if (admin.SP_Role__c != 'Super Admin' && admin.SP_Role__c != 'Portal Admin') {
            return SPUtils.errorResponse('Admin access required.');
        }

        List<Contact> users = [
            SELECT Id, SP_Role__c FROM Contact WHERE Id = :contactId LIMIT 1
        ];

        if (users.isEmpty()) {
            return SPUtils.errorResponse('User not found.');
        }

        try {
            SPUtils.assertUpdateable(Contact.sObjectType, 'Contact');
            users[0].SP_Role__c = role;
            update users[0];
        } catch (DmlException e) {
            String msg = e.getDmlMessage(0);
            if (msg != null && msg.contains('Super Admin')) {
                return SPUtils.errorResponse('The SP Manage Super Admin permission is required to assign the Super Admin role. Contact your Salesforce administrator.');
            }
            return SPUtils.errorResponse('Failed to update role: ' + msg);
        }

        return SPUtils.successResponse('User role updated to ' + role + '.');
    }

    // ─── Portal Statistics ───────────────────────────────────────

    /**
     * @description Returns aggregate stats for the admin dashboard.
     * @return Map with user counts, case counts, etc.
     */
    @RemoteAction
    global static Map<String, Object> getPortalStats(String sessionToken) {
        Contact admin = SPUtils.validateSession(sessionToken);
        if (admin == null || (admin.SP_Role__c != 'Super Admin' && admin.SP_Role__c != 'Portal Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        Integer totalUsers = [SELECT COUNT() FROM Contact WHERE SP_Username__c != null];
        Integer activeUsers = [SELECT COUNT() FROM Contact WHERE SP_Enabled__c = true AND SP_Status__c = 'Active'];
        Integer pendingUsers = [SELECT COUNT() FROM Contact WHERE SP_Status__c = 'Pending' AND SP_Username__c != null];

        Integer totalCases = [SELECT COUNT() FROM Case WHERE Origin = 'Support Portal'];
        Integer openCases = [SELECT COUNT() FROM Case WHERE Origin = 'Support Portal' AND IsClosed = false];
        Integer closedCases = [SELECT COUNT() FROM Case WHERE Origin = 'Support Portal' AND IsClosed = true];

        return SPUtils.successResponse(new Map<String, Object>{
            'users' => new Map<String, Object>{
                'total' => totalUsers,
                'active' => activeUsers,
                'pending' => pendingUsers,
                'inactive' => totalUsers - activeUsers - pendingUsers
            },
            'cases' => new Map<String, Object>{
                'total' => totalCases,
                'open' => openCases,
                'closed' => closedCases
            }
        });
    }

    // ─── Get Portal Settings ─────────────────────────────────────

    /**
     * @description Returns the current portal settings for admin display.
     * @return Map with all settings
     */
    @RemoteAction
    global static Map<String, Object> getPortalSettings(String sessionToken) {
        Contact admin = SPUtils.validateSession(sessionToken);
        if (admin == null || (admin.SP_Role__c != 'Super Admin' && admin.SP_Role__c != 'Portal Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        Support_Portal__mdt settings = SPUtils.getSettings();
        SP_Portal_Theme__c theme = SPUtils.getTheme();

        return SPUtils.successResponse(new Map<String, Object>{
            'registrationMode' => settings.Registration_Mode__c,
            'caseVisibility' => settings.Case_Visibility__c,
            'sessionDuration' => settings.Session_Duration_Minutes__c,
            'supportEmail' => settings.Support_Email__c,
            'supportPhone' => settings.Support_Phone__c,
            'agentforceEnabled' => settings.Enable_Agentforce_Chat__c,
            'themeJson' => theme.Theme_JSON__c,
            'logoUrl' => theme.Logo_URL__c,
            'companyName' => theme.Company_Name__c,
            'sourceWebsiteUrl' => theme.Source_Website_URL__c,
            'portalConfigJson' => theme.Portal_Config_JSON__c
        });
    }

    // ─── Save Portal Settings ────────────────────────────────────

    /**
     * @description Saves portal configuration (field visibility, product options).
     * Stored in the SP_Portal_Theme__c record's Portal_Config_JSON__c field.
     * @param configJson JSON string of portal configuration
     * @param sessionToken Session token for auth
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> savePortalSettings(String configJson, String sessionToken) {
        Contact admin = SPUtils.validateSession(sessionToken);
        if (admin == null || (admin.SP_Role__c != 'Super Admin' && admin.SP_Role__c != 'Portal Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        try {
            SP_Portal_Theme__c theme = SPUtils.getTheme();
            if (theme.Id == null) {
                SPUtils.assertCreateable(SP_Portal_Theme__c.sObjectType, 'Portal Config');
                theme.Name = 'Default';
            } else {
                SPUtils.assertUpdateable(SP_Portal_Theme__c.sObjectType, 'Portal Config');
            }
            theme.Portal_Config_JSON__c = configJson;
            upsert theme;

            // Clear cache so next read picks up the new value
            SPUtils.cachedTheme = null;

            return SPUtils.successResponse('Portal settings saved.');
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to save settings: ' + e.getMessage());
        }
    }
}
