// Seed published SP_FAQ__c records from the hardcoded FAQ_DATA
// These will replace the React fallback data on the portal KB page

List<SP_FAQ__c> faqs = new List<SP_FAQ__c>();
Integer sortOrder = 1;

// === Getting Started (4) ===
faqs.add(new SP_FAQ__c(
    Question__c = 'How do I create a support case?',
    Answer__c = 'Navigate to "My Cases" from the top menu, then click "New Case". Fill in the subject, description, and optionally set a priority and product. You can paste screenshots directly or drag files into the form.',
    Category__c = 'Getting Started',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'What products are supported?',
    Answer__c = 'We support all Funnelists products including Radar (source intelligence & content aggregation), Canvas (AI image generation & creative studio), AgentPM (AI project management), Resolve (help desk solution — coming soon), and LeadGen (CSV-based lead enrichment). Select the relevant product when creating a case for faster routing.',
    Category__c = 'Getting Started',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'How do I track the status of my case?',
    Answer__c = 'Go to "My Cases" to see all your open and closed cases. Click on any case number to view full details, comments, and attachments. You\'ll see the current status (New, Open, Working, Escalated, or Closed) at the top of the case.',
    Category__c = 'Getting Started',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'Can I attach files to my case?',
    Answer__c = 'Yes! When creating or viewing a case, you can attach files by clicking "Attach File" or by dragging files directly onto the page. You can also paste screenshots from your clipboard using Ctrl+V (or Cmd+V on Mac).',
    Category__c = 'Getting Started',
    Published__c = true,
    Sort_Order__c = sortOrder++
));

// === Account & Settings (3) ===
faqs.add(new SP_FAQ__c(
    Question__c = 'How do I change my password?',
    Answer__c = 'Go to Settings from the user menu (top right). Under "Change Password", enter your current password and your new password. Passwords must be at least 8 characters with at least one uppercase letter and one number.',
    Category__c = 'Account & Settings',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'I forgot my password. How do I reset it?',
    Answer__c = 'On the login page, click "Forgot password?" and enter your email address. You\'ll receive a reset link via email. The link is valid for 24 hours.',
    Category__c = 'Account & Settings',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'Who can access my cases?',
    Answer__c = 'By default, only you can see your cases. If your organization has "Company-Wide" visibility enabled, other team members from your company may also be able to see and comment on your cases.',
    Category__c = 'Account & Settings',
    Published__c = true,
    Sort_Order__c = sortOrder++
));

// === Products & Features (4) ===
faqs.add(new SP_FAQ__c(
    Question__c = 'What is Radar?',
    Answer__c = 'Radar is our source intelligence and content aggregation platform. It monitors RSS feeds, YouTube channels, Polymarket predictions, and more — then uses AI to summarize and surface the content that matters to you. Key features include multi-source monitoring, AI summaries, and custom dashboards.',
    Category__c = 'Products & Features',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'What is Canvas?',
    Answer__c = 'Canvas is our AI image generation and creative studio. It offers 8 creative tools: image generation, icon creation, logo design, character creation, image restyling, image tools, watermarks, and showcase galleries. Perfect for creating professional visual assets without a design team.',
    Category__c = 'Products & Features',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'What is AgentPM?',
    Answer__c = 'AgentPM is our AI-powered project management tool. It includes Notes and Plans for organizing work, Agent task orchestration for automating workflows, and Forge for turning PRDs into code. It helps teams move faster from idea to execution.',
    Category__c = 'Products & Features',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'How do I suggest a new feature?',
    Answer__c = 'Visit the Ideas & Feedback page from the navigation menu. You can submit new ideas, browse existing suggestions, and vote on ideas from other users. Our product team reviews the most popular ideas regularly.',
    Category__c = 'Products & Features',
    Published__c = true,
    Sort_Order__c = sortOrder++
));

// === Troubleshooting (4) ===
faqs.add(new SP_FAQ__c(
    Question__c = 'My Radar sources are not updating. What should I do?',
    Answer__c = 'First, check the source status in your Radar dashboard — sources with a red indicator may have invalid URLs or expired feeds. Try refreshing the source manually. If the issue persists, verify the RSS/YouTube URL is still active and create a support case with the source details.',
    Category__c = 'Troubleshooting',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'Canvas image generation is failing or timing out.',
    Answer__c = 'This can happen with very detailed prompts or during peak usage. Try simplifying your prompt or using a different creative tool. Also check that your account has remaining generation credits. Our team monitors generation queues and will address capacity issues promptly.',
    Category__c = 'Troubleshooting',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'AgentPM tasks are not syncing correctly.',
    Answer__c = 'Verify that your workspace integration settings are properly configured by going to AgentPM Settings > Integrations. Check that the Agent orchestration feature is enabled and that task assignments have valid team members. If the issue persists, create a support case with your workspace ID.',
    Category__c = 'Troubleshooting',
    Published__c = true,
    Sort_Order__c = sortOrder++
));
faqs.add(new SP_FAQ__c(
    Question__c = 'The portal is loading slowly.',
    Answer__c = 'Try clearing your browser cache and cookies. Test on a different network or device to rule out connectivity issues. If the problem persists, check for browser extensions that might interfere and create a support case with details about which pages are affected.',
    Category__c = 'Troubleshooting',
    Published__c = true,
    Sort_Order__c = sortOrder++
));

insert faqs;
System.debug('Inserted ' + faqs.size() + ' FAQ records');
for (SP_FAQ__c f : faqs) {
    System.debug(f.Name + ' | ' + f.Category__c + ' | ' + f.Question__c);
}
