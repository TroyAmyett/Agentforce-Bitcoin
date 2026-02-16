/**
 * @description RemoteAction controller for Case management in the
 * Support Portal. Handles CRUD operations on Cases, CaseComments,
 * and file attachments. Respects Case_Visibility setting.
 *
 * Security: Uses `without sharing` because the Salesforce Sites guest user
 * has no case ownership; security is enforced via session validation and
 * row-level visibility rules (User_Only vs Company_Wide). CRUD checks
 * are performed before all DML operations.
 *
 * @author Funnelists
 * @date 2026-02-06
 */
global without sharing class SPCaseController {

    // Extension constructor for VF page (required for remoting on Sites)
    global SPCaseController(SPAuthController controller) {}

    private static final Integer PAGE_SIZE = 20;

    // ─── Get Cases (List) ────────────────────────────────────────

    /**
     * @description Returns a paginated list of Cases for the authenticated user.
     * Respects the Case_Visibility__c setting (User_Only or Company_Wide).
     * @param contactId The authenticated user's Contact Id
     * @param statusFilter Optional status filter ('Open', 'Closed', or blank for all)
     * @param pageNumber Page number (1-based)
     * @return Map with case list, pagination info, and stats
     */
    @RemoteAction
    global static Map<String, Object> getCases(String contactId, String statusFilter, Integer pageNumber) {
        Contact user = SPUtils.getPortalUser(contactId);
        if (user == null) {
            return SPUtils.errorResponse('Invalid user session.');
        }

        Support_Portal__mdt settings = SPUtils.getSettings();
        String visibility = settings.Case_Visibility__c;

        // Build dynamic query using bind variables (AppExchange best practice)
        Id ownerFilterId = (visibility == 'Company_Wide' && user.AccountId != null)
            ? user.AccountId : user.Id;
        String ownerField = (visibility == 'Company_Wide' && user.AccountId != null)
            ? 'AccountId' : 'ContactId';

        String baseFields = 'Id, CaseNumber, Subject, Status, Priority, '
            + 'CreatedDate, LastModifiedDate, Description, Origin, '
            + 'SP_Product__c, Contact.Name, Account.Name';
        String query = 'SELECT ' + baseFields + ' FROM Case WHERE ' + ownerField + ' = :ownerFilterId';
        String countQuery = 'SELECT COUNT() FROM Case WHERE ' + ownerField + ' = :ownerFilterId';

        // Status filter
        if (String.isNotBlank(statusFilter)) {
            if (statusFilter == 'Open') {
                query += ' AND IsClosed = false';
                countQuery += ' AND IsClosed = false';
            } else if (statusFilter == 'Closed') {
                query += ' AND IsClosed = true';
                countQuery += ' AND IsClosed = true';
            }
        }

        Integer totalRecords = Database.countQuery(countQuery);

        query += ' ORDER BY LastModifiedDate DESC';

        // Pagination
        Integer pg = (pageNumber != null && pageNumber > 0) ? pageNumber : 1;
        Integer offset = (pg - 1) * PAGE_SIZE;
        query += ' LIMIT ' + PAGE_SIZE + ' OFFSET ' + offset;

        List<Case> cases = Database.query(query);

        // Build case summary list
        List<Map<String, Object>> caseList = new List<Map<String, Object>>();
        for (Case c : cases) {
            caseList.add(new Map<String, Object>{
                'id' => c.Id,
                'caseNumber' => c.CaseNumber,
                'subject' => c.Subject,
                'status' => c.Status,
                'priority' => c.Priority,
                'createdDate' => c.CreatedDate,
                'lastModifiedDate' => c.LastModifiedDate,
                'product' => c.SP_Product__c,
                'contactName' => c.Contact?.Name,
                'accountName' => c.Account?.Name
            });
        }

        // Case stats
        Integer openCount = 0;
        Integer closedCount = 0;
        Integer newTodayCount = 0;
        Date today = Date.today();
        if (visibility == 'Company_Wide' && user.AccountId != null) {
            openCount = [SELECT COUNT() FROM Case WHERE AccountId = :user.AccountId AND IsClosed = false];
            closedCount = [SELECT COUNT() FROM Case WHERE AccountId = :user.AccountId AND IsClosed = true];
            newTodayCount = [SELECT COUNT() FROM Case WHERE AccountId = :user.AccountId AND CreatedDate = TODAY];
        } else {
            openCount = [SELECT COUNT() FROM Case WHERE ContactId = :user.Id AND IsClosed = false];
            closedCount = [SELECT COUNT() FROM Case WHERE ContactId = :user.Id AND IsClosed = true];
            newTodayCount = [SELECT COUNT() FROM Case WHERE ContactId = :user.Id AND CreatedDate = TODAY];
        }

        return SPUtils.successResponse(new Map<String, Object>{
            'cases' => caseList,
            'totalRecords' => totalRecords,
            'pageSize' => PAGE_SIZE,
            'currentPage' => pg,
            'totalPages' => (Integer) Math.ceil((Decimal) totalRecords / PAGE_SIZE),
            'stats' => new Map<String, Object>{
                'open' => openCount,
                'closed' => closedCount,
                'total' => openCount + closedCount,
                'newToday' => newTodayCount
            }
        });
    }

    // ─── Get Case Detail ─────────────────────────────────────────

    /**
     * @description Returns full Case detail including comments and attachments.
     * @param contactId The authenticated user's Contact Id
     * @param caseId The Case Id to retrieve
     * @return Map with case data, comments, and attachments
     */
    @RemoteAction
    global static Map<String, Object> getCaseDetail(String contactId, String caseId) {
        Contact user = SPUtils.getPortalUser(contactId);
        if (user == null) {
            return SPUtils.errorResponse('Invalid user session.');
        }

        // Verify the user can access this Case (bind variables for security)
        Support_Portal__mdt settings = SPUtils.getSettings();
        Id ownerFilterId = (settings.Case_Visibility__c == 'Company_Wide' && user.AccountId != null)
            ? user.AccountId : user.Id;
        String ownerField = (settings.Case_Visibility__c == 'Company_Wide' && user.AccountId != null)
            ? 'AccountId' : 'ContactId';
        Id caseIdBind = caseId;

        String query = 'SELECT Id, CaseNumber, Subject, Status, Priority, Description, '
            + 'CreatedDate, LastModifiedDate, ClosedDate, Origin, Type, '
            + 'SP_Product__c, Contact.Name, Account.Name, IsClosed '
            + 'FROM Case WHERE Id = :caseIdBind '
            + 'AND ' + ownerField + ' = :ownerFilterId LIMIT 1';

        List<Case> cases = Database.query(query);
        if (cases.isEmpty()) {
            return SPUtils.errorResponse('Case not found or access denied.');
        }

        Case c = cases[0];
        Map<String, Object> caseMap = new Map<String, Object>{
            'id' => c.Id,
            'caseNumber' => c.CaseNumber,
            'subject' => c.Subject,
            'status' => c.Status,
            'priority' => c.Priority,
            'description' => c.Description,
            'createdDate' => c.CreatedDate,
            'lastModifiedDate' => c.LastModifiedDate,
            'closedDate' => c.ClosedDate,
            'origin' => c.Origin,
            'type' => c.Type,
            'product' => c.SP_Product__c,
            'isClosed' => c.IsClosed,
            'contactName' => c.Contact?.Name,
            'accountName' => c.Account?.Name
        };

        // Get Comments — merge classic CaseComments + Chatter FeedItems
        List<Map<String, Object>> commentList = new List<Map<String, Object>>();

        // 1) Classic CaseComments (public only)
        List<CaseComment> comments = [
            SELECT Id, CommentBody, CreatedDate, CreatedBy.Name, IsPublished
            FROM CaseComment
            WHERE ParentId = :c.Id
            AND IsPublished = true
            ORDER BY CreatedDate DESC
        ];
        for (CaseComment cc : comments) {
            commentList.add(new Map<String, Object>{
                'id' => cc.Id,
                'body' => cc.CommentBody,
                'createdDate' => cc.CreatedDate,
                'author' => cc.CreatedBy?.Name
            });
        }

        // 2) Chatter FeedItems (public posts)
        // Uses dynamic SOQL so the query is validated at runtime,
        // allowing the try/catch to handle orgs without Chatter.
        try {
            Id feedParentId = c.Id;
            String feedQuery = 'SELECT Id, Body, CreatedDate, CreatedBy.Name '
                + 'FROM FeedItem '
                + 'WHERE ParentId = :feedParentId '
                + 'AND Type IN (\'TextPost\', \'ContentPost\', \'LinkPost\') '
                + 'ORDER BY CreatedDate DESC';
            List<FeedItem> feedItems = Database.query(feedQuery);
            for (FeedItem fi : feedItems) {
                if (String.isNotBlank(fi.Body)) {
                    commentList.add(new Map<String, Object>{
                        'id' => fi.Id,
                        'body' => fi.Body,
                        'createdDate' => fi.CreatedDate,
                        'author' => fi.CreatedBy?.Name
                    });
                }
            }
        } catch (Exception e) {
            // FeedItem query may fail if Chatter is not enabled — safe to ignore
            System.debug(LoggingLevel.WARN, 'FeedItem query failed: ' + e.getMessage());
        }

        // Sort merged list by createdDate descending
        commentList.sort(new CommentDateComparator());

        // Get Attachments (ContentDocumentLinks)
        List<ContentDocumentLink> docLinks = [
            SELECT ContentDocument.Title, ContentDocument.FileExtension,
                ContentDocument.ContentSize, ContentDocument.CreatedDate,
                ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :c.Id
            ORDER BY ContentDocument.CreatedDate DESC
        ];

        List<Map<String, Object>> attachments = new List<Map<String, Object>>();
        for (ContentDocumentLink cdl : docLinks) {
            attachments.add(new Map<String, Object>{
                'id' => cdl.ContentDocumentId,
                'title' => cdl.ContentDocument.Title,
                'extension' => cdl.ContentDocument.FileExtension,
                'size' => cdl.ContentDocument.ContentSize,
                'createdDate' => cdl.ContentDocument.CreatedDate
            });
        }

        return SPUtils.successResponse(new Map<String, Object>{
            'case' => caseMap,
            'comments' => commentList,
            'attachments' => attachments
        });
    }

    // ─── Create Case ─────────────────────────────────────────────

    /**
     * @description Creates a new support Case for the authenticated user.
     * @param contactId The authenticated user's Contact Id
     * @param subject Case subject
     * @param description Case description
     * @param priority Case priority
     * @return Map with the created case data
     */
    @RemoteAction
    global static Map<String, Object> createCase(
        String contactId, String subject, String description, String priority, String product, String caseType
    ) {
        Contact user = SPUtils.getPortalUser(contactId);
        if (user == null) {
            return SPUtils.errorResponse('Invalid user session.');
        }

        if (String.isBlank(subject)) {
            return SPUtils.errorResponse('Subject is required.');
        }

        Case newCase = new Case(
            ContactId = user.Id,
            AccountId = user.AccountId,
            Subject = subject,
            Description = description,
            Priority = String.isNotBlank(priority) ? priority : 'Medium',
            Origin = 'Support Portal',
            Status = 'New'
        );
        if (String.isNotBlank(product)) {
            newCase.SP_Product__c = product;
        }
        if (String.isNotBlank(caseType)) {
            newCase.Type = caseType;
        }
        SPUtils.assertCreateable(Case.sObjectType, 'Case');
        insert newCase;

        // Query back for full details
        Case inserted = [
            SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate
            FROM Case WHERE Id = :newCase.Id LIMIT 1
        ];

        return SPUtils.successResponse(new Map<String, Object>{
            'id' => inserted.Id,
            'caseNumber' => inserted.CaseNumber,
            'subject' => inserted.Subject,
            'status' => inserted.Status,
            'priority' => inserted.Priority,
            'createdDate' => inserted.CreatedDate
        });
    }

    // ─── Close Case ─────────────────────────────────────────────

    /**
     * @description Closes a Case by setting its Status to 'Closed'.
     * @param contactId The authenticated user's Contact Id
     * @param caseId The Case Id to close
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> closeCase(String contactId, String caseId) {
        Contact user = SPUtils.getPortalUser(contactId);
        if (user == null) {
            return SPUtils.errorResponse('Invalid user session.');
        }

        // Verify Case access (bind variables for security)
        Support_Portal__mdt settings = SPUtils.getSettings();
        Id ownerFilterId = (settings.Case_Visibility__c == 'Company_Wide' && user.AccountId != null)
            ? user.AccountId : user.Id;
        String ownerField = (settings.Case_Visibility__c == 'Company_Wide' && user.AccountId != null)
            ? 'AccountId' : 'ContactId';
        Id caseIdBind = caseId;

        String query = 'SELECT Id, Status, IsClosed FROM Case '
            + 'WHERE Id = :caseIdBind '
            + 'AND ' + ownerField + ' = :ownerFilterId LIMIT 1';

        List<Case> cases = Database.query(query);
        if (cases.isEmpty()) {
            return SPUtils.errorResponse('Case not found or access denied.');
        }

        Case c = cases[0];
        if (c.IsClosed) {
            return SPUtils.errorResponse('Case is already closed.');
        }

        SPUtils.assertUpdateable(Case.sObjectType, 'Case');
        c.Status = 'Closed';
        update c;

        // Send email notification
        sendCaseNotification(user, c.Id, 'closed');

        return SPUtils.successResponse('Case closed successfully.');
    }

    // ─── Add Comment ─────────────────────────────────────────────

    /**
     * @description Adds a public comment to a Case.
     * @param contactId The authenticated user's Contact Id
     * @param caseId The Case to comment on
     * @param body The comment text
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> addComment(String contactId, String caseId, String body) {
        Contact user = SPUtils.getPortalUser(contactId);
        if (user == null) {
            return SPUtils.errorResponse('Invalid user session.');
        }

        if (String.isBlank(body)) {
            return SPUtils.errorResponse('Comment body is required.');
        }

        // Verify Case access
        Support_Portal__mdt settings = SPUtils.getSettings();
        List<Case> cases;
        if (settings.Case_Visibility__c == 'Company_Wide' && user.AccountId != null) {
            cases = [SELECT Id FROM Case WHERE Id = :caseId AND AccountId = :user.AccountId LIMIT 1];
        } else {
            cases = [SELECT Id FROM Case WHERE Id = :caseId AND ContactId = :user.Id LIMIT 1];
        }

        if (cases.isEmpty()) {
            return SPUtils.errorResponse('Case not found or access denied.');
        }

        SPUtils.assertCreateable(CaseComment.sObjectType, 'Comment');
        CaseComment comment = new CaseComment(
            ParentId = caseId,
            CommentBody = user.Name + ': ' + body,
            IsPublished = true
        );
        insert comment;

        return SPUtils.successResponse(new Map<String, Object>{
            'id' => comment.Id,
            'body' => comment.CommentBody,
            'createdDate' => Datetime.now(),
            'author' => user.Name
        });
    }

    // ─── Upload Attachment ───────────────────────────────────────

    /**
     * @description Uploads a file attachment to a Case.
     * @param contactId The authenticated user's Contact Id
     * @param caseId The Case to attach the file to
     * @param fileName The file name
     * @param base64Body The file content as base64 encoded string
     * @return Map with success or error
     */
    @RemoteAction
    global static Map<String, Object> uploadAttachment(
        String contactId, String caseId, String fileName, String base64Body
    ) {
        Contact user = SPUtils.getPortalUser(contactId);
        if (user == null) {
            return SPUtils.errorResponse('Invalid user session.');
        }

        if (String.isBlank(fileName) || String.isBlank(base64Body)) {
            return SPUtils.errorResponse('File name and content are required.');
        }

        // Validate file size (base64 is ~4/3 of original size; limit to 4.5MB decoded)
        if (base64Body.length() > 6000000) {
            return SPUtils.errorResponse('File is too large. Maximum size is 4.5 MB.');
        }

        // Verify Case access
        Support_Portal__mdt settings = SPUtils.getSettings();
        List<Case> cases;
        if (settings.Case_Visibility__c == 'Company_Wide' && user.AccountId != null) {
            cases = [SELECT Id FROM Case WHERE Id = :caseId AND AccountId = :user.AccountId LIMIT 1];
        } else {
            cases = [SELECT Id FROM Case WHERE Id = :caseId AND ContactId = :user.Id LIMIT 1];
        }

        if (cases.isEmpty()) {
            return SPUtils.errorResponse('Case not found or access denied.');
        }

        // Create ContentVersion (CRUD check)
        SPUtils.assertCreateable(ContentVersion.sObjectType, 'Attachment');
        ContentVersion cv = new ContentVersion(
            Title = fileName,
            PathOnClient = fileName,
            VersionData = EncodingUtil.base64Decode(base64Body),
            FirstPublishLocationId = caseId
        );
        insert cv;

        return SPUtils.successResponse(new Map<String, Object>{
            'id' => cv.Id,
            'title' => cv.Title,
            'createdDate' => Datetime.now()
        });
    }

    // ─── Get Attachment Content ──────────────────────────────────

    /**
     * @description Returns the base64-encoded content of a ContentDocument
     * so the React SPA can preview / download files.
     * @param contactId The authenticated user's Contact Id
     * @param contentDocumentId The ContentDocument Id
     * @return Map with file metadata and base64Data
     */
    @RemoteAction
    global static Map<String, Object> getAttachmentContent(String contactId, String contentDocumentId) {
        Contact user = SPUtils.getPortalUser(contactId);
        if (user == null) {
            return SPUtils.errorResponse('Invalid user session.');
        }
        if (String.isBlank(contentDocumentId)) {
            return SPUtils.errorResponse('Content document ID is required.');
        }

        List<ContentVersion> versions = [
            SELECT Id, Title, FileExtension, VersionData, ContentSize
            FROM ContentVersion
            WHERE ContentDocumentId = :contentDocumentId
            AND IsLatest = true
            LIMIT 1
        ];
        if (versions.isEmpty()) {
            return SPUtils.errorResponse('Attachment not found.');
        }

        ContentVersion cv = versions[0];
        if (cv.ContentSize > 4500000) {
            return SPUtils.errorResponse('File is too large to preview. Maximum size is 4.5 MB.');
        }

        return SPUtils.successResponse(new Map<String, Object>{
            'title' => cv.Title,
            'extension' => cv.FileExtension,
            'size' => cv.ContentSize,
            'base64Data' => EncodingUtil.base64Encode(cv.VersionData)
        });
    }

    // ─── Email Notification ──────────────────────────────────────

    /**
     * @description Sends an email notification for case updates.
     * Best-effort: failures are logged but do not block the operation.
     * @param portalUser The portal Contact
     * @param caseId The Case Id
     * @param notificationType Type of notification (closed, comment)
     */
    private static void sendCaseNotification(Contact portalUser, Id caseId, String notificationType) {
        try {
            // Map notification type to template DeveloperName
            String templateName;
            if (notificationType == 'closed') {
                templateName = 'SP_Case_Closed';
            } else if (notificationType == 'comment') {
                templateName = 'SP_Case_Comment';
            } else {
                templateName = 'SP_Case_Update';
            }

            Id templateId = SPUtils.getEmailTemplateId(templateName);
            if (templateId != null) {
                SPUtils.sendTemplateEmail(templateId, portalUser.Id, caseId);
            } else {
                // Fallback: inline plain text when template is not deployed
                sendCaseNotificationFallback(portalUser, caseId, notificationType);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Case notification email failed: ' + e.getMessage());
        }
    }

    /**
     * @description Fallback inline case notification when email template is not deployed.
     */
    private static void sendCaseNotificationFallback(Contact portalUser, Id caseId, String notificationType) {
        Case c = [SELECT CaseNumber, Subject, Status FROM Case WHERE Id = :caseId LIMIT 1];

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();

        Id oweaId = SPUtils.getOrgWideEmailAddressId();
        if (oweaId != null) {
            mail.setOrgWideEmailAddressId(oweaId);
        }

        mail.setToAddresses(new List<String>{ portalUser.Email });

        String body = 'Hi ' + portalUser.FirstName + ',\n\n';

        if (notificationType == 'closed') {
            mail.setSubject('Case Closed: ' + c.CaseNumber + ' - ' + c.Subject);
            body += 'Your support case has been closed.\n\n';
        } else if (notificationType == 'comment') {
            mail.setSubject('New Comment on Case: ' + c.CaseNumber);
            body += 'A new comment has been added to your support case.\n\n';
        } else {
            mail.setSubject('Case Update: ' + c.CaseNumber);
            body += 'Your support case has been updated.\n\n';
        }

        body += 'Case Number: ' + c.CaseNumber + '\n';
        body += 'Subject: ' + c.Subject + '\n';
        body += 'Status: ' + c.Status + '\n\n';
        body += 'Log in to the support portal to view details.\n';

        mail.setPlainTextBody(body);

        Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail }, false);
    }

    // ─── Comparator for sorting merged comment lists ─────────────

    private class CommentDateComparator implements Comparator<Map<String, Object>> {
        public Integer compare(Map<String, Object> a, Map<String, Object> b) {
            Datetime dateA = (Datetime) a.get('createdDate');
            Datetime dateB = (Datetime) b.get('createdDate');
            if (dateA == null && dateB == null) return 0;
            if (dateA == null) return 1;
            if (dateB == null) return -1;
            // Descending order (newest first)
            if (dateB > dateA) return 1;
            if (dateA > dateB) return -1;
            return 0;
        }
    }
}
