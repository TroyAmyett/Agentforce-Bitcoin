/**
 * @description RemoteAction controller for the Ideas & Feedback feature.
 * Handles CRUD operations on SP_Idea__c and vote management.
 *
 * Security: Uses `without sharing` because the Salesforce Sites guest user
 * has no record ownership; security is enforced via session validation.
 * CRUD checks are performed before all DML operations.
 *
 * @author Funnelists
 * @date 2026-02-07
 */
global without sharing class SPIdeaController {

    // Extension constructor for VF page (required for remoting on Sites)
    global SPIdeaController(SPAuthController controller) {}

    private static final Integer PAGE_SIZE = 20;

    // ─── Get Ideas ────────────────────────────────────────────────

    @RemoteAction
    global static Map<String, Object> getIdeas(
        String contactId, String categoryFilter, Integer page, String sessionToken
    ) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null) {
            return SPUtils.errorResponse('Invalid session.');
        }

        Boolean isAdmin = user.SP_Role__c == 'Portal Admin' || user.SP_Role__c == 'Super Admin';

        try {
            String query = 'SELECT Id, Name, Title__c, Description__c, Category__c, '
                + 'Status__c, Vote_Count__c, Voted_Contact_Ids__c, Product__c, Published__c, '
                + 'Contact__r.FirstName, Contact__r.LastName, Account__r.Name, '
                + 'CreatedDate '
                + 'FROM SP_Idea__c ';

            List<String> conditions = new List<String>();
            if (String.isNotBlank(categoryFilter) && categoryFilter != 'All') {
                conditions.add('Category__c = :categoryFilter');
            }
            // Non-admins only see published ideas
            if (!isAdmin) {
                conditions.add('Published__c = true');
            }
            if (!conditions.isEmpty()) {
                query += 'WHERE ' + String.join(conditions, ' AND ') + ' ';
            }
            query += 'ORDER BY Vote_Count__c DESC, CreatedDate DESC';

            List<SP_Idea__c> allIdeas = Database.query(query);
            Integer totalRecords = allIdeas.size();
            Integer pg = Math.max(1, page != null ? page : 1);
            Integer startIdx = (pg - 1) * PAGE_SIZE;
            Integer endIdx = Math.min(startIdx + PAGE_SIZE, totalRecords);

            List<Map<String, Object>> ideasList = new List<Map<String, Object>>();
            for (Integer i = startIdx; i < endIdx; i++) {
                SP_Idea__c idea = allIdeas[i];
                String authorName = '';
                if (idea.Contact__r != null) {
                    authorName = (idea.Contact__r.FirstName != null ? idea.Contact__r.FirstName + ' ' : '')
                        + (idea.Contact__r.LastName != null ? idea.Contact__r.LastName : '');
                }
                // Check if current user voted
                Boolean voted = false;
                if (String.isNotBlank(idea.Voted_Contact_Ids__c) && String.isNotBlank(contactId)) {
                    voted = idea.Voted_Contact_Ids__c.contains(contactId);
                }

                ideasList.add(new Map<String, Object>{
                    'id' => idea.Id,
                    'ideaNumber' => idea.Name,
                    'title' => idea.Title__c,
                    'description' => idea.Description__c,
                    'category' => idea.Category__c,
                    'status' => idea.Status__c,
                    'votes' => idea.Vote_Count__c != null ? Integer.valueOf(idea.Vote_Count__c) : 0,
                    'voted' => voted,
                    'product' => idea.Product__c,
                    'published' => idea.Published__c,
                    'author' => authorName.trim(),
                    'accountName' => idea.Account__r != null ? idea.Account__r.Name : '',
                    'createdDate' => String.valueOf(idea.CreatedDate)
                });
            }

            return SPUtils.successResponse(new Map<String, Object>{
                'ideas' => ideasList,
                'totalRecords' => totalRecords,
                'pageSize' => PAGE_SIZE,
                'currentPage' => pg,
                'totalPages' => Math.max(1, (Integer)Math.ceil((Decimal)totalRecords / PAGE_SIZE))
            });
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to load ideas: ' + e.getMessage());
        }
    }

    // ─── Create Idea ──────────────────────────────────────────────

    @RemoteAction
    global static Map<String, Object> createIdea(
        String contactId, String title, String description,
        String category, String product, String sessionToken
    ) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null) {
            return SPUtils.errorResponse('Invalid session.');
        }

        if (String.isBlank(title)) {
            return SPUtils.errorResponse('Title is required.');
        }

        try {
            SPUtils.assertCreateable(SP_Idea__c.sObjectType, 'Idea');
            SP_Idea__c idea = new SP_Idea__c();
            idea.Title__c = title;
            idea.Description__c = description;
            idea.Category__c = String.isNotBlank(category) ? category : 'Feature';
            idea.Product__c = product;
            idea.Status__c = 'New';
            idea.Published__c = true;
            idea.Vote_Count__c = 1;
            idea.Voted_Contact_Ids__c = contactId; // Auto-vote for own idea
            idea.Contact__c = contactId;
            idea.Account__c = user.AccountId;

            insert idea;

            return SPUtils.successResponse(new Map<String, Object>{
                'id' => idea.Id,
                'ideaNumber' => idea.Name,
                'title' => idea.Title__c
            });
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to create idea: ' + e.getMessage());
        }
    }

    // ─── Vote for Idea ────────────────────────────────────────────

    @RemoteAction
    global static Map<String, Object> voteForIdea(
        String contactId, String ideaId, String sessionToken
    ) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null) {
            return SPUtils.errorResponse('Invalid session.');
        }

        try {
            SPUtils.assertUpdateable(SP_Idea__c.sObjectType, 'Idea');
            SP_Idea__c idea = [
                SELECT Id, Vote_Count__c, Voted_Contact_Ids__c
                FROM SP_Idea__c WHERE Id = :ideaId LIMIT 1
            ];

            String voterIds = idea.Voted_Contact_Ids__c != null ? idea.Voted_Contact_Ids__c : '';
            Boolean alreadyVoted = voterIds.contains(contactId);

            if (alreadyVoted) {
                // Remove vote
                List<String> ids = voterIds.split(',');
                ids.remove(ids.indexOf(contactId));
                idea.Voted_Contact_Ids__c = String.join(ids, ',');
                idea.Vote_Count__c = Math.max(0, (idea.Vote_Count__c != null ? idea.Vote_Count__c : 0) - 1);
            } else {
                // Add vote
                idea.Voted_Contact_Ids__c = String.isBlank(voterIds)
                    ? contactId
                    : voterIds + ',' + contactId;
                idea.Vote_Count__c = (idea.Vote_Count__c != null ? idea.Vote_Count__c : 0) + 1;
            }

            update idea;

            return SPUtils.successResponse(new Map<String, Object>{
                'voted' => !alreadyVoted,
                'votes' => Integer.valueOf(idea.Vote_Count__c)
            });
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to vote: ' + e.getMessage());
        }
    }

    // ─── Update Idea Status (Admin only) ──────────────────────────

    @RemoteAction
    global static Map<String, Object> updateIdeaStatus(
        String ideaId, String status, String sessionToken
    ) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null || (user.SP_Role__c != 'Portal Admin' && user.SP_Role__c != 'Super Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        try {
            SPUtils.assertUpdateable(SP_Idea__c.sObjectType, 'Idea');
            SP_Idea__c idea = [SELECT Id, Status__c FROM SP_Idea__c WHERE Id = :ideaId LIMIT 1];
            idea.Status__c = status;
            update idea;

            return SPUtils.successResponse('Idea status updated.');
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to update status: ' + e.getMessage());
        }
    }

    // ─── Toggle Idea Published (Admin only) ─────────────────────

    @RemoteAction
    global static Map<String, Object> toggleIdeaPublished(
        String ideaId, Boolean published, String sessionToken
    ) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null || (user.SP_Role__c != 'Portal Admin' && user.SP_Role__c != 'Super Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        try {
            SPUtils.assertUpdateable(SP_Idea__c.sObjectType, 'Idea');
            SP_Idea__c idea = [SELECT Id, Published__c FROM SP_Idea__c WHERE Id = :ideaId LIMIT 1];
            idea.Published__c = published;
            update idea;

            return SPUtils.successResponse(new Map<String, Object>{
                'published' => published
            });
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to update idea: ' + e.getMessage());
        }
    }
}
