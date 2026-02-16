// =====================================================================
// Create Funnelists Product Knowledge Articles
// Run via: sf apex run --file scripts/create-kb-articles.apex
// Summary field is limited to 1000 chars, so articles are split into
// focused topics for better Agentforce search matching.
// =====================================================================

List<Knowledge__kav> articles = new List<Knowledge__kav>();

// ─── 1. Radar Overview ──────────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Radar: Salesforce Deployment Management Platform',
    UrlName = 'radar-overview',
    Summary = 'Radar is Funnelists deployment management platform for Salesforce. It provides visibility and control over metadata deployments across multiple orgs. Key features: deployment tracking with real-time component-level status, scheduled deployments with timezone support, full deployment history and audit trail, conflict detection between source and target orgs, one-click rollback, multi-org management from a single dashboard, and secure OAuth-based Connected App integration. Supports all Salesforce metadata types including Apex, LWC, objects, fields, flows, profiles, and permission sets. Plans: Starter $49/mo (3 orgs), Professional $149/mo (unlimited orgs, rollback, conflict detection), Enterprise (custom).',
    Language = 'en_US'
));

// ─── 2. Radar Troubleshooting ───────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Radar Troubleshooting: Deployment Issues',
    UrlName = 'radar-troubleshooting',
    Summary = 'Common Radar deployment issues: (1) "Connected App authorization expired" - Re-authorize in Radar Settings > Connected Orgs. Radar v2.5+ has auto-refresh. (2) Deployment runs at wrong time - verify timezone in schedule dialog. v2.4.x defaulted to UTC, fixed in v2.5.0. (3) Blank dashboard after deploy - re-authorize Connected App and clear browser cache. v2.4.1 hotfix. (4) False positive conflicts - run Full Metadata Sync to re-baseline. (5) Changes not visible after deploy - check Setup > Deployment Status, log out/in for profiles. Tips: always check Deployment Status, include dependent metadata, use Validate Only first, re-authorize every 90 days.',
    Language = 'en_US'
));

// ─── 3. Canvas Overview ─────────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Canvas: Visual Funnel Builder Platform',
    UrlName = 'canvas-overview',
    Summary = 'Canvas is Funnelists visual funnel builder for designing marketing and sales funnels. Features: drag-and-drop editor for multi-step funnels with landing pages and email sequences, team templates for sharing across your org, real-time collaboration with live cursors, PDF export for presentations, analytics integration for conversion tracking, version history, and a community template marketplace. Getting started: create a workspace, start from blank or template, drag components from left panel, configure content and goals, share with team, export when ready. Supported browsers: Chrome 90+, Firefox 120+, Edge 90+, Safari 16+. Plans: Free (3 funnels), Team $19/user/mo, Business $39/user/mo.',
    Language = 'en_US'
));

// ─── 4. Canvas Troubleshooting ──────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Canvas Troubleshooting: Export and Collaboration Issues',
    UrlName = 'canvas-troubleshooting',
    Summary = 'Common Canvas issues: (1) PDF export empty/0-byte - happens with 8+ steps due to rendering timeout. Export in sections, use Chrome, disable popup blocker. Fixed in v3.2.1. (2) Team templates not visible - save to "Team Templates" not "My Templates". Fixed in v3.2.0. (3) Collaboration cursors missing - all users need Editor access, same funnel version, no firewall blocking WebSockets on port 443. (4) Drag-and-drop broken - disable browser extensions especially ad blockers, use incognito window, update Chrome to 90+. (5) Zero analytics conversions - verify tracking code installed on all funnel landing pages, check Analytics tab in Canvas settings.',
    Language = 'en_US'
));

// ─── 5. AgentPM Overview ────────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'AgentPM: AI Meeting Intelligence Platform',
    UrlName = 'agentpm-overview',
    Summary = 'AgentPM is Funnelists AI-powered meeting intelligence platform. It captures, transcribes, and extracts insights from meetings. Features: auto-join recording for Google Meet, Zoom, and Teams; real-time transcription with speaker ID at 95%+ accuracy; AI action item extraction; Salesforce Task sync linked to Opportunities, Accounts, and Contacts; AI meeting summaries; searchable archive; variable-speed playback with bookmarks. Salesforce integration creates Tasks from action items, links meetings to records, logs activities on timelines. Supports Google Calendar and Outlook. Plans: Starter $15/user/mo (20hrs), Professional $35/user/mo (unlimited, Salesforce sync), Enterprise (custom AI).',
    Language = 'en_US'
));

// ─── 6. AgentPM Troubleshooting ─────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'AgentPM Troubleshooting: Recording and Sync Issues',
    UrlName = 'agentpm-troubleshooting',
    Summary = 'Common AgentPM issues: (1) Playback stalls in Firefox - use Chrome/Edge, enable media.webm.enabled in Firefox about:config. Fix in v1.6. (2) Tasks not syncing to Salesforce - re-authorize in Settings > Integrations, verify Task Sync enabled, check user has Create Tasks permission. Auto-refresh in v1.5.2. (3) Bot not joining meetings - check platform support (Meet, Zoom Business+, Teams), valid meeting link, auto-join enabled, calendar integration green. (4) Poor transcription - use dedicated mic, minimize noise, enable Enhanced Accuracy mode for 98%+. (5) Wrong Salesforce record linked - update Contact/Lead emails, or manually link from meeting detail page.',
    Language = 'en_US'
));

// ─── 7. Resolve Overview ────────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Resolve: Issue Tracking and Incident Management',
    UrlName = 'resolve-overview',
    Summary = 'Resolve is Funnelists issue tracking and incident management platform. Features: customizable issue tracking with workflows and priorities, structured incident response with severity levels and on-call rotation, SLA monitoring with automated alerts, Kanban boards (New > In Progress > Review > Done), integration hub for Slack/Jira/PagerDuty/Salesforce and 50+ tools, reporting dashboards for resolution times and SLA compliance, automation rules for auto-assign and escalation. Use cases: customer support ticket management, engineering bug tracking, DevOps incident response with on-call schedules, cross-functional issue visibility. Plans: Team $29/user/mo, Business $59/user/mo, Enterprise (custom).',
    Language = 'en_US'
));

// ─── 8. LeadGen Overview ────────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'LeadGen: Lead Generation and Capture Platform',
    UrlName = 'leadgen-overview',
    Summary = 'LeadGen is Funnelists lead generation platform for converting visitors into qualified leads. Features: smart forms with conditional logic and A/B testing, no-code landing page builder, AI lead scoring, real-time Salesforce bi-directional sync with Leads/Contacts/Campaigns, automated email nurture sequences, analytics dashboard for conversions and ROI, GDPR compliance with consent management. Setup: connect Salesforce org, create form or use template, map fields to Salesforce, embed on website or use LeadGen landing page, set up scoring and nurture, monitor analytics. Plans: Starter $79/mo (1K leads), Growth $199/mo (10K leads, A/B testing), Enterprise (unlimited).',
    Language = 'en_US'
));

// ─── 9. Support Portal Guide ────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Funnelists Support Portal: How to Get Help',
    UrlName = 'support-portal-guide',
    Summary = 'The Funnelists Support Portal helps you create cases, track issues, and get help. To create a case: click New Case, enter subject and description, set priority and product, attach files, submit. Case statuses: New (not yet reviewed), Open (under review), Working (engineer assigned), Escalated (senior support), Closed (resolved). Blue dots on case numbers indicate new activity. Use the Dashboard for stats and recent cases, My Cases for full list with filters. Submit feature ideas on the Ideas page where you can also vote. The Agentforce chat (bottom right) provides quick help. Check the Knowledge Base for common answers.',
    Language = 'en_US'
));

// ─── 10. Account Security ───────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Account Security, Passwords, and User Roles',
    UrlName = 'account-security',
    Summary = 'Password requirements: minimum 8 characters, one uppercase, one number. Change password in Settings > Change Password. Forgot password: click link on login page for email reset (24hr expiry). Security: passwords stored with one-way hashing, sessions expire after 30min inactivity (configurable), HTTPS with TLS 1.2+, 2FA available for admins. Roles: User (create cases, submit ideas), Portal Admin (manage users, view all cases, configure settings), Super Admin (full admin including role assignment and branding). Data privacy: stored on Salesforce infrastructure, cases visible only to you and admins, GDPR/CCPA/SOC2 compliant. Contact support@funnelists.com for data requests.',
    Language = 'en_US'
));

// ─── 11. Integration Guide ──────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Funnelists Salesforce and Platform Integration Guide',
    UrlName = 'integration-guide',
    Summary = 'All Funnelists products connect to Salesforce via OAuth 2.0 Connected Apps. Setup: create Connected App in Salesforce Setup with OAuth, callback URL https://app.funnelists.com/oauth/callback, scopes api and refresh_token, paste Consumer Key/Secret in product settings, click Authorize. Radar needs Modify All Data for deployments, re-authorize every 90 days. AgentPM needs Create/Edit Tasks, optionally View All on Opportunity/Account. LeadGen needs Create/Edit Leads, configure field mapping. Slack integration available for Resolve and Radar via Slack App Directory. REST APIs available for all products at docs.funnelists.com/api with workspace API keys.',
    Language = 'en_US'
));

// ─── 12. Billing and Plans ──────────────────────────────────────
articles.add(new Knowledge__kav(
    Title = 'Funnelists Pricing, Plans, and Billing',
    UrlName = 'billing-plans',
    Summary = 'Radar: Starter $49/mo (3 orgs), Professional $149/mo (unlimited), Enterprise. Canvas: Free (3 funnels), Team $19/user/mo, Business $39/user/mo. AgentPM: Starter $15/user/mo (20hrs), Professional $35/user/mo (unlimited), Enterprise. Resolve: Team $29/user/mo, Business $59/user/mo, Enterprise. LeadGen: Starter $79/mo (1K leads), Growth $199/mo (10K leads), Enterprise. All plans billed monthly or annually (20% annual discount). 14-day free trial on any plan, no credit card required. Upgrades immediate, downgrades at next billing cycle. Contact billing@funnelists.com for invoicing or purchase orders.',
    Language = 'en_US'
));

// ─── Insert all articles ────────────────────────────────────────
insert articles;
System.debug(LoggingLevel.ERROR, 'INSERTED: ' + articles.size() + ' articles');

// ─── Publish all articles ───────────────────────────────────────
List<Knowledge__kav> inserted = [
    SELECT Id, KnowledgeArticleId, Title
    FROM Knowledge__kav
    WHERE Id IN :articles
];
for (Knowledge__kav a : inserted) {
    KbManagement.PublishingService.publishArticle(a.KnowledgeArticleId, true);
}
System.debug(LoggingLevel.ERROR, 'PUBLISHED: ' + inserted.size() + ' articles');
