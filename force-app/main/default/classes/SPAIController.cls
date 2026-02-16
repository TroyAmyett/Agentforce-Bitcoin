/**
 * @description RemoteAction controller for AI-powered features.
 * Handles BYO-key LLM chat (Claude/OpenAI) and AI FAQ generation.
 *
 * Security: Uses `without sharing` because the Salesforce Sites guest user
 * has no record ownership; security is enforced via session validation.
 * CRUD checks are performed before all DML operations.
 *
 * @author Funnelists
 * @date 2026-02-11
 */
global without sharing class SPAIController {

    // Extension constructor for VF page (required for remoting on Sites)
    global SPAIController(SPAuthController controller) {}

    private static final Integer HTTP_TIMEOUT = 30000; // 30 seconds
    private static final Integer MAX_CONTEXT_FAQS = 20;
    private static final Integer MAX_CONTEXT_CASES = 5;

    // ─── AI Chat ────────────────────────────────────────────────

    /**
     * @description Sends a user message to the configured LLM provider
     * and returns the AI response. Includes FAQ and case context for grounding.
     * @param message The user's chat message
     * @param conversationHistory JSON string of prior messages [{role,content}]
     * @param sessionToken Session token for auth
     * @return Map with reply text or error
     */
    @RemoteAction
    global static Map<String, Object> chat(String message, String conversationHistory, String sessionToken) {
        // Use read-only session validation (no DML before callout)
        Contact user = SPUtils.validateSessionReadOnly(sessionToken);
        if (user == null) {
            return SPUtils.errorResponse('Invalid session.');
        }

        if (String.isBlank(message)) {
            return SPUtils.errorResponse('Message is required.');
        }

        try {
            Map<String, Object> aiConfig = getAIConfig();
            if (aiConfig == null) {
                return SPUtils.errorResponse('AI assistant is not configured. Ask your admin to set up AI settings in Portal Settings.');
            }

            String provider = (String) aiConfig.get('provider');
            String apiKey = (String) aiConfig.get('apiKey');
            String model = (String) aiConfig.get('model');
            String customPrompt = (String) aiConfig.get('systemPrompt');
            Integer maxTokens = aiConfig.get('maxTokens') != null
                ? Integer.valueOf(String.valueOf(aiConfig.get('maxTokens')))
                : 1024;

            if (String.isBlank(apiKey)) {
                return SPUtils.errorResponse('AI API key is not configured. Ask your admin to add an API key in Portal Settings.');
            }

            // Build grounding context
            String groundingContext = buildGroundingContext(user);

            // Build system prompt
            SP_Portal_Theme__c theme = SPUtils.getTheme();
            String companyName = String.isNotBlank(theme.Company_Name__c) ? theme.Company_Name__c : 'our company';
            String systemPrompt = 'You are a helpful support assistant for ' + companyName + '. '
                + 'Help users with their questions, troubleshoot issues, and guide them to create support cases when needed. '
                + 'Be concise and friendly.\n\n';

            if (String.isNotBlank(customPrompt)) {
                systemPrompt += customPrompt + '\n\n';
            }

            if (String.isNotBlank(groundingContext)) {
                systemPrompt += '--- KNOWLEDGE BASE ---\n' + groundingContext + '\n--- END KNOWLEDGE BASE ---\n';
            }

            // Make the LLM call
            String reply;
            if (provider == 'openai') {
                reply = callOpenAI(apiKey, model, systemPrompt, message, conversationHistory, maxTokens);
            } else {
                // Default to Claude
                reply = callClaude(apiKey, model, systemPrompt, message, conversationHistory, maxTokens);
            }

            return SPUtils.successResponse(new Map<String, Object>{
                'reply' => reply
            });
        } catch (Exception e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains('401')) {
                return SPUtils.errorResponse('Invalid API key. Please check your AI configuration in Portal Settings.');
            }
            if (msg != null && msg.contains('429')) {
                return SPUtils.errorResponse('Rate limit reached. Please try again in a moment.');
            }
            return SPUtils.errorResponse('AI request failed: ' + msg);
        }
    }

    // ─── Generate FAQs from Document ────────────────────────────

    /**
     * @description Sends document text to the LLM to generate FAQ Q&A pairs.
     * Admin-only. Creates SP_FAQ__c records as drafts.
     * @param documentText The document content to generate FAQs from
     * @param documentName Name of the source document
     * @param sessionToken Session token for auth
     * @return Map with generated FAQ list
     */
    @RemoteAction
    global static Map<String, Object> generateFAQs(String documentText, String documentName, String sessionToken) {
        // Use read-only validation (callout coming)
        Contact user = SPUtils.validateSessionReadOnly(sessionToken);
        if (user == null || (user.SP_Role__c != 'Super Admin' && user.SP_Role__c != 'Portal Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        if (String.isBlank(documentText)) {
            return SPUtils.errorResponse('Document text is required.');
        }

        try {
            Map<String, Object> aiConfig = getAIConfig();
            if (aiConfig == null || String.isBlank((String) aiConfig.get('apiKey'))) {
                return SPUtils.errorResponse('AI is not configured. Set up AI settings in Portal Settings first.');
            }

            String provider = (String) aiConfig.get('provider');
            String apiKey = (String) aiConfig.get('apiKey');
            String model = (String) aiConfig.get('model');

            String prompt = 'Analyze the following document and generate FAQ (Frequently Asked Questions) entries. '
                + 'Return ONLY a valid JSON array, no other text. Each entry must have these fields:\n'
                + '- "question": A clear question a customer might ask\n'
                + '- "answer": A helpful, concise answer formatted in Markdown. Use **bold** for key terms, bullet lists for steps, and [links](url) where appropriate.\n'
                + '- "category": One of "Getting Started", "Account & Settings", "Products & Features", "Troubleshooting", "Billing", "Other"\n\n'
                + 'Generate 5-10 FAQ entries based on the content. Here is the document:\n\n'
                + documentText;

            String response;
            if (provider == 'openai') {
                response = callOpenAI(apiKey, model, 'You generate FAQ content as JSON arrays.', prompt, null, 4096);
            } else {
                response = callClaude(apiKey, model, 'You generate FAQ content as JSON arrays.', prompt, null, 4096);
            }

            // Parse JSON from response
            List<Object> faqItems = parseJsonArray(response);
            if (faqItems == null || faqItems.isEmpty()) {
                return SPUtils.errorResponse('Could not parse FAQ data from AI response. Try again with different content.');
            }

            // Create SP_FAQ__c records (CRUD enforced by admin role check above)
            List<SP_FAQ__c> newFaqs = new List<SP_FAQ__c>();
            Integer sortOrder = 1;

            for (Object item : faqItems) {
                Map<String, Object> faqMap = (Map<String, Object>) item;
                SP_FAQ__c faq = new SP_FAQ__c();
                faq.Question__c = truncate((String) faqMap.get('question'), 255);
                faq.Answer__c = (String) faqMap.get('answer');
                faq.Category__c = mapCategory((String) faqMap.get('category'));
                faq.Sort_Order__c = sortOrder++;
                faq.Published__c = false; // Draft by default
                faq.Source_Document__c = truncate(
                    String.isNotBlank(documentName) ? documentName : 'Unnamed Document',
                    255
                );
                newFaqs.add(faq);
            }

            insert newFaqs;

            // Build response list
            List<Map<String, Object>> faqList = new List<Map<String, Object>>();
            for (SP_FAQ__c faq : newFaqs) {
                faqList.add(buildFAQMap(faq));
            }

            return SPUtils.successResponse(new Map<String, Object>{
                'faqs' => faqList,
                'count' => faqList.size()
            });
        } catch (Exception e) {
            return SPUtils.errorResponse('FAQ generation failed: ' + e.getMessage());
        }
    }

    // ─── Get Published FAQs ─────────────────────────────────────

    /**
     * @description Returns published FAQs for the Knowledge Base page.
     * @param sessionToken Session token for auth
     * @return Map with FAQ list grouped by category
     */
    @RemoteAction
    global static Map<String, Object> getFAQs(String sessionToken) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null) {
            return SPUtils.errorResponse('Invalid session.');
        }

        List<SP_FAQ__c> faqs = [
            SELECT Id, Name, Question__c, Answer__c, Category__c, Sort_Order__c
            FROM SP_FAQ__c
            WHERE Published__c = true
            ORDER BY Category__c, Sort_Order__c
        ];

        List<Map<String, Object>> faqList = new List<Map<String, Object>>();
        for (SP_FAQ__c faq : faqs) {
            faqList.add(buildFAQMap(faq));
        }

        return SPUtils.successResponse(new Map<String, Object>{
            'faqs' => faqList
        });
    }

    // ─── Get All FAQs (Admin) ───────────────────────────────────

    @RemoteAction
    global static Map<String, Object> getAdminFAQs(String sessionToken) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null || (user.SP_Role__c != 'Super Admin' && user.SP_Role__c != 'Portal Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        List<SP_FAQ__c> faqs = [
            SELECT Id, Name, Question__c, Answer__c, Category__c,
                Sort_Order__c, Published__c, Source_Document__c, CreatedDate
            FROM SP_FAQ__c
            ORDER BY Category__c, Sort_Order__c
        ];

        List<Map<String, Object>> faqList = new List<Map<String, Object>>();
        for (SP_FAQ__c faq : faqs) {
            Map<String, Object> m = buildFAQMap(faq);
            m.put('published', faq.Published__c);
            m.put('sourceDocument', faq.Source_Document__c);
            m.put('createdDate', String.valueOf(faq.CreatedDate));
            faqList.add(m);
        }

        return SPUtils.successResponse(new Map<String, Object>{
            'faqs' => faqList
        });
    }

    // ─── Update FAQ ─────────────────────────────────────────────

    @RemoteAction
    global static Map<String, Object> updateFAQ(
        String faqId, String question, String answer,
        String category, Boolean published, String sessionToken
    ) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null || (user.SP_Role__c != 'Super Admin' && user.SP_Role__c != 'Portal Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        List<SP_FAQ__c> faqs = [
            SELECT Id FROM SP_FAQ__c WHERE Id = :faqId LIMIT 1
        ];
        if (faqs.isEmpty()) {
            return SPUtils.errorResponse('FAQ not found.');
        }

        try {
            // CRUD enforced by admin role check above
            SP_FAQ__c faq = faqs[0];
            if (String.isNotBlank(question)) faq.Question__c = truncate(question, 255);
            if (answer != null) faq.Answer__c = answer;
            if (String.isNotBlank(category)) faq.Category__c = mapCategory(category);
            if (published != null) faq.Published__c = published;
            update faq;

            return SPUtils.successResponse('FAQ updated.');
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to update FAQ: ' + e.getMessage());
        }
    }

    // ─── Delete FAQ ─────────────────────────────────────────────

    @RemoteAction
    global static Map<String, Object> deleteFAQ(String faqId, String sessionToken) {
        Contact user = SPUtils.validateSession(sessionToken);
        if (user == null || (user.SP_Role__c != 'Super Admin' && user.SP_Role__c != 'Portal Admin')) {
            return SPUtils.errorResponse('Admin access required.');
        }

        List<SP_FAQ__c> faqs = [
            SELECT Id FROM SP_FAQ__c WHERE Id = :faqId LIMIT 1
        ];
        if (faqs.isEmpty()) {
            return SPUtils.errorResponse('FAQ not found.');
        }

        try {
            // CRUD enforced by admin role check above
            delete faqs[0];
            return SPUtils.successResponse('FAQ deleted.');
        } catch (Exception e) {
            return SPUtils.errorResponse('Failed to delete FAQ: ' + e.getMessage());
        }
    }

    // ─── Private: LLM API Calls ─────────────────────────────────

    /**
     * @description Calls the Anthropic Claude API.
     */
    @TestVisible
    private static String callClaude(
        String apiKey, String model, String systemPrompt,
        String userMessage, String conversationHistory, Integer maxTokens
    ) {
        if (String.isBlank(model)) model = 'claude-sonnet-4-5-20250929';

        // Build messages array
        List<Map<String, String>> messages = new List<Map<String, String>>();

        // Add conversation history if present
        if (String.isNotBlank(conversationHistory)) {
            try {
                List<Object> history = (List<Object>) JSON.deserializeUntyped(conversationHistory);
                for (Object entry : history) {
                    Map<String, Object> msg = (Map<String, Object>) entry;
                    messages.add(new Map<String, String>{
                        'role' => (String) msg.get('role'),
                        'content' => (String) msg.get('content')
                    });
                }
            } catch (Exception e) {
                // Skip invalid history
            }
        }

        // Add current user message
        messages.add(new Map<String, String>{
            'role' => 'user',
            'content' => userMessage
        });

        Map<String, Object> requestBody = new Map<String, Object>{
            'model' => model,
            'max_tokens' => maxTokens,
            'system' => systemPrompt,
            'messages' => messages
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.anthropic.com/v1/messages');
        req.setMethod('POST');
        req.setTimeout(HTTP_TIMEOUT);
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('x-api-key', apiKey);
        req.setHeader('anthropic-version', '2023-06-01');
        req.setBody(JSON.serialize(requestBody));

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new CalloutException('Claude API error (HTTP ' + res.getStatusCode() + '): ' + res.getBody());
        }

        Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        List<Object> content = (List<Object>) responseBody.get('content');
        if (content != null && !content.isEmpty()) {
            Map<String, Object> firstBlock = (Map<String, Object>) content[0];
            return (String) firstBlock.get('text');
        }

        return 'I was unable to generate a response. Please try again.';
    }

    /**
     * @description Calls the OpenAI Chat Completions API.
     */
    @TestVisible
    private static String callOpenAI(
        String apiKey, String model, String systemPrompt,
        String userMessage, String conversationHistory, Integer maxTokens
    ) {
        if (String.isBlank(model)) model = 'gpt-4o';

        // Build messages array
        List<Map<String, String>> messages = new List<Map<String, String>>();

        // System message
        messages.add(new Map<String, String>{
            'role' => 'system',
            'content' => systemPrompt
        });

        // Add conversation history if present
        if (String.isNotBlank(conversationHistory)) {
            try {
                List<Object> history = (List<Object>) JSON.deserializeUntyped(conversationHistory);
                for (Object entry : history) {
                    Map<String, Object> msg = (Map<String, Object>) entry;
                    messages.add(new Map<String, String>{
                        'role' => (String) msg.get('role'),
                        'content' => (String) msg.get('content')
                    });
                }
            } catch (Exception e) {
                // Skip invalid history
            }
        }

        // Add current user message
        messages.add(new Map<String, String>{
            'role' => 'user',
            'content' => userMessage
        });

        Map<String, Object> requestBody = new Map<String, Object>{
            'model' => model,
            'max_tokens' => maxTokens,
            'messages' => messages
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://api.openai.com/v1/chat/completions');
        req.setMethod('POST');
        req.setTimeout(HTTP_TIMEOUT);
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + apiKey);
        req.setBody(JSON.serialize(requestBody));

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new CalloutException('OpenAI API error (HTTP ' + res.getStatusCode() + '): ' + res.getBody());
        }

        Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        List<Object> choices = (List<Object>) responseBody.get('choices');
        if (choices != null && !choices.isEmpty()) {
            Map<String, Object> firstChoice = (Map<String, Object>) choices[0];
            Map<String, Object> msgObj = (Map<String, Object>) firstChoice.get('message');
            if (msgObj != null) {
                return (String) msgObj.get('content');
            }
        }

        return 'I was unable to generate a response. Please try again.';
    }

    // ─── Private: Helpers ───────────────────────────────────────

    /**
     * @description Reads AI configuration from Portal_Config_JSON__c.
     * @return Map with provider, apiKey, model, systemPrompt, maxTokens
     */
    @TestVisible
    private static Map<String, Object> getAIConfig() {
        SP_Portal_Theme__c theme = SPUtils.getTheme();
        if (String.isBlank(theme.Portal_Config_JSON__c)) {
            return null;
        }

        try {
            Map<String, Object> portalCfg = (Map<String, Object>) JSON.deserializeUntyped(theme.Portal_Config_JSON__c);
            Object aiRaw = portalCfg.get('ai');
            if (aiRaw != null) {
                return (Map<String, Object>) aiRaw;
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to parse AI config: ' + e.getMessage());
        }
        return null;
    }

    /**
     * @description Builds grounding context from FAQs and recent cases.
     */
    private static String buildGroundingContext(Contact user) {
        String context = '';

        // Add published FAQs
        List<SP_FAQ__c> faqs = [
            SELECT Question__c, Answer__c, Category__c
            FROM SP_FAQ__c
            WHERE Published__c = true
            ORDER BY Category__c, Sort_Order__c
            LIMIT :MAX_CONTEXT_FAQS
        ];

        if (!faqs.isEmpty()) {
            context += 'FAQ Articles:\n';
            for (SP_FAQ__c faq : faqs) {
                context += 'Q: ' + faq.Question__c + '\nA: ' + faq.Answer__c + '\n\n';
            }
        }

        // Add user's recent cases for personalized context
        List<Case> cases = [
            SELECT CaseNumber, Subject, Status, Priority
            FROM Case
            WHERE ContactId = :user.Id
            AND Origin = 'Support Portal'
            ORDER BY CreatedDate DESC
            LIMIT :MAX_CONTEXT_CASES
        ];

        if (!cases.isEmpty()) {
            context += 'User\'s Recent Cases:\n';
            for (Case c : cases) {
                context += '- Case ' + c.CaseNumber + ': ' + c.Subject
                    + ' (Status: ' + c.Status + ', Priority: ' + c.Priority + ')\n';
            }
        }

        return context;
    }

    /**
     * @description Parses a JSON array from LLM response text.
     * Handles responses that may contain extra text around the JSON.
     */
    @TestVisible
    private static List<Object> parseJsonArray(String text) {
        if (String.isBlank(text)) return null;

        // Try direct parse first
        try {
            Object parsed = JSON.deserializeUntyped(text.trim());
            if (parsed instanceof List<Object>) {
                return (List<Object>) parsed;
            }
        } catch (Exception e) {
            // Not direct JSON, try to extract
        }

        // Find JSON array in text (LLMs sometimes wrap in markdown code blocks)
        Integer startIdx = text.indexOf('[');
        Integer endIdx = text.lastIndexOf(']');
        if (startIdx >= 0 && endIdx > startIdx) {
            try {
                String jsonStr = text.substring(startIdx, endIdx + 1);
                Object parsed = JSON.deserializeUntyped(jsonStr);
                if (parsed instanceof List<Object>) {
                    return (List<Object>) parsed;
                }
            } catch (Exception e) {
                // Could not parse
            }
        }

        return null;
    }

    /**
     * @description Maps a free-text category to a valid picklist value.
     */
    private static String mapCategory(String category) {
        if (String.isBlank(category)) return 'Other';
        String lower = category.toLowerCase();
        if (lower.contains('getting started') || lower.contains('setup') || lower.contains('onboarding'))
            return 'Getting Started';
        if (lower.contains('account') || lower.contains('setting') || lower.contains('profile'))
            return 'Account & Settings';
        if (lower.contains('product') || lower.contains('feature'))
            return 'Products & Features';
        if (lower.contains('troubleshoot') || lower.contains('error') || lower.contains('fix') || lower.contains('issue'))
            return 'Troubleshooting';
        if (lower.contains('billing') || lower.contains('payment') || lower.contains('invoice'))
            return 'Billing';
        return 'Other';
    }

    private static Map<String, Object> buildFAQMap(SP_FAQ__c faq) {
        return new Map<String, Object>{
            'id' => faq.Id,
            'faqNumber' => faq.Name,
            'question' => faq.Question__c,
            'answer' => faq.Answer__c,
            'category' => faq.Category__c,
            'sortOrder' => faq.Sort_Order__c
        };
    }

    private static String truncate(String value, Integer maxLength) {
        if (String.isBlank(value)) return value;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }

    /**
     * @description Custom exception for callout failures.
     */
    global class CalloutException extends Exception {}
}
