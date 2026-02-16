# Funnelists Resolve — Product Overview

*For use by Claw (Open Claw) for market research, pricing, landing pages, and lead generation.*

---

## What It Is

**Funnelists Resolve** is a branded, AI-powered self-service support portal built natively on Salesforce. It gives businesses a modern customer support experience — their brand, their AI, their Salesforce data — without building anything from scratch.

It's a React single-page application that deploys as a Salesforce Static Resource, runs inside a Visualforce page on Salesforce Sites, and connects natively to Service Cloud, Knowledge, and Agentforce. Every case, comment, attachment, and user record lives in standard Salesforce objects. Nothing proprietary. Nothing to migrate.

---

## Who It's For

**Primary audience:** Salesforce customers (any edition with Service Cloud) who want to offer self-service support to their end customers without building a custom portal.

**Ideal customer profile:**
- Mid-market and enterprise companies already on Salesforce
- Support teams drowning in tickets that could be self-served
- Companies evaluating or already using Agentforce
- Organizations with existing knowledge content (docs, guides, FAQs) that isn't accessible to customers
- Businesses that want branded customer experiences (not generic Salesforce Communities)

**Buyer personas:**
- VP of Customer Success / Support
- Salesforce Admin / Architect
- CTO / CIO evaluating Agentforce ROI
- IT Directors managing Salesforce implementations

---

## Core Features

### For Customers (End Users)

1. **Personalized Dashboard** — Case stats, quick actions, recent cases, and searchable knowledge articles. One screen to find answers or get help.

2. **Case Management** — Create, track, and comment on support cases. Full threaded timeline with status badges, priority levels, and timestamps. Everything syncs to Salesforce Service Cloud in real time.

3. **File Attachments** — Drag and drop, clipboard paste (Ctrl+V screenshots), and file upload. Images, videos, PDFs, documents. Video attachments play inline so agents see exactly what the customer sees.

4. **Built-in Screen Recorder** — Click "Record Screen" when submitting a case. The browser captures the screen/tab while the customer reproduces the issue. Click stop, and the recording auto-attaches to the case. No external tools needed.

5. **Knowledge Base** — Searchable library of articles organized by product and category. Powered by Salesforce Knowledge. Articles are structured with clear headings and step-by-step instructions.

6. **FAQ Library** — Expandable FAQ sections organized by category (Getting Started, Troubleshooting, Features, Billing, Integrations, General). Searchable. Can be hand-written or AI-generated.

7. **Ideas & Voting** — Customers submit feature requests and product ideas. Other users vote on ideas they care about. Gives the product team clear signal on what matters most.

8. **AI Chat Assistant** — Conversational AI that answers questions using the company's own knowledge base, FAQs, and case history as grounding context. Not a generic chatbot — it knows the company's products.

### For Admins (Portal Admins & Super Admins)

9. **Admin Dashboard** — Bird's eye view of total users, active users, pending registrations, and case statistics.

10. **User Management** — Search users by name or email. Activate/deactivate accounts. Assign roles (User, Portal Admin, Super Admin).

11. **AI FAQ Generator** — Paste any document (product guide, release notes, troubleshooting doc) and AI generates structured Q&A pairs automatically. Review, edit, categorize, and publish with one click. Published FAQs go live instantly.

12. **Theme & Style Importer** — Paste a website URL and the portal extracts the brand identity: logo, primary colors, background colors, font choices. Live preview. Save. The entire portal becomes the customer's brand in seconds. No CSS, no design tools, no dev team.

13. **Portal Settings** — Command center for AI provider config, chat mode selection, branding, and feature visibility controls.

### AI & Agentforce Integration

14. **Three Chat Modes** — All configurable from Portal Settings, no code changes:
    - **Built-in Assistant** — Lightweight keyword-based helper, runs in the browser
    - **Salesforce Messaging for Web** — Connects to a real Agentforce Service Agent with knowledge grounding, case lookup, and live agent escalation
    - **AI Assistant (BYO Key)** — Claude or OpenAI via server-side API calls, grounded with the company's own content

15. **Bring Your Own Key** — Companies choose their AI provider (Claude/Anthropic or OpenAI), enter their API key, select their model. They control costs and the provider relationship. Works alongside or instead of Agentforce.

16. **Knowledge Powers Everything** — Published FAQs and Knowledge articles serve as grounding context for all AI touchpoints. One content investment feeds the entire self-service experience.

---

## Technical Foundation

- **100% Salesforce Native** — All data in standard + custom Salesforce objects (Cases, Contacts, Knowledge, custom objects for FAQ, Ideas, Themes, Sessions)
- **No External Database** — No Heroku, no AWS, no third-party data stores
- **React SPA** — Modern, fast, responsive UI deployed as a Salesforce Static Resource
- **Visualforce + Salesforce Sites** — Publicly accessible portal with session-based authentication
- **Apex Backend** — All business logic in Apex (Salesforce's server-side language), 219+ tests passing, 83%+ code coverage
- **Lightning App** — Dedicated Salesforce Lightning app for internal admin management
- **Role-Based Access** — Three roles (User, Portal Admin, Super Admin) with granular permissions

---

## Key Differentiators

### vs. Salesforce Experience Cloud / Communities
- **Faster to deploy** — No Experience Cloud license, no complex configuration
- **Fully branded** — Theme importer makes it look custom-built, not template-driven
- **AI-first** — Built-in AI chat, FAQ generation, and Agentforce integration from day one
- **Modern UX** — React SPA with glassmorphism design, not the standard Salesforce UI

### vs. Zendesk / Freshdesk / Intercom
- **Salesforce native** — No integration middleware, no data sync issues, no duplicate records
- **Your data stays in Salesforce** — Cases, contacts, knowledge all in the CRM your team already uses
- **Agentforce ready** — Direct integration with Salesforce's AI agent platform
- **No per-agent pricing** — Portal runs on existing Salesforce licenses

### vs. Building Custom
- **Weeks, not months** — Deploy a branded portal without a development project
- **AI features included** — FAQ generator, AI chat, screen recorder all built in
- **Maintained and updated** — Not a one-off build that becomes technical debt

---

## Wow Moments (for demos, videos, and landing pages)

These are the features that create "I gotta have this" reactions:

1. **Theme & Style Importer** — Paste a URL, portal becomes their brand. Visual, instant, no-code. 45 seconds.

2. **Doc-to-FAQ Import** — Paste a product doc, AI generates a complete FAQ library, publish with one click. "You just built your help center in 30 seconds."

3. **Built-in Screen Recorder** — Click record, reproduce the issue, stop. Video auto-attaches to the case. No external tools.

4. **AI Chat with Their Own Content** — Ask a question, get an answer grounded in their actual knowledge base and FAQs. Not generic — specific to their products.

5. **Agentforce Handoff** — AI agent answers questions, escalates to live human when needed. Native Salesforce.

6. **Ideas & Voting** — Customers vote on feature requests. Roadmap prioritizes itself.

7. **One Knowledge Base Powers Everything** — FAQ page, AI chat, Agentforce agent all draw from the same content. One import, every touchpoint gets smarter.

---

## Video Assets (In Production)

**Phase 1 — Sizzle Clips (landing pages, social, ads)**
| Video | Duration | Purpose |
|-------|----------|---------|
| Welcome Overview | ~1:30 | "What is Resolve?" intro |
| Theme & Style Importer | ~0:45 | Wow #1 — Brand it |
| Doc-to-FAQ Import | ~0:50 | Wow #2 — Fill it with AI |
| Screen Recording | ~0:45 | Wow #3 — Show, don't tell |

**Phase 2 — Full Walkthroughs (post-demo, onboarding)**
| Video | Duration | Purpose |
|-------|----------|---------|
| Managing Cases | ~1:45 | Deep dive on case workflow |
| Help & Ideas | ~1:15 | Self-service + feedback loop |
| Knowledge Base | ~1:30 | Content management |
| AI Assistant | ~1:15 | BYO-key AI chat |
| Admin Tools | ~2:00 | Full admin suite |
| Agentforce Integration | ~1:45 | Salesforce AI integration |

Avatar: Alex (HeyGen AV4)
Total: 10 videos, 35 scenes, ~13 minutes

---

## Market Context

- Salesforce has 150,000+ customers globally
- Agentforce launched in 2024 and is Salesforce's top strategic priority
- Companies are investing in AI-powered customer service but struggling with implementation
- Experience Cloud is powerful but complex and expensive to customize
- The "branded portal" market is growing as companies want to own the customer experience
- BYO-LLM is increasingly attractive as companies build proprietary AI capabilities

---

## Competitive Landscape (for Claw's research)

**Direct competitors to research:**
- Salesforce Experience Cloud / Customer Community
- Zendesk Guide + Answer Bot
- Freshdesk / Freshservice portals
- Intercom Help Center
- HubSpot Service Hub Knowledge Base
- Helpjuice, Document360, KnowledgeOwl (standalone KB tools)

**Adjacent / complementary:**
- Agentforce (Salesforce) — Resolve integrates with it, not against it
- Claude / OpenAI — Resolve is a consumer of their APIs, brings them into Salesforce
- Coveo, SearchUnify — AI search for Salesforce (potential integration partners)

**Key research questions for Claw:**
1. What are Salesforce customers paying for Experience Cloud licenses today?
2. What's the typical implementation cost/timeline for a branded Salesforce portal?
3. How are Agentforce early adopters measuring ROI?
4. What pricing models work for Salesforce-native add-on products? (per-org, per-user, tiered)
5. Which Salesforce AppExchange products in the support/portal category have traction?
6. What landing page patterns convert best for Salesforce ecosystem products?
7. Where do Salesforce admins and architects hang out online? (communities, events, publications)

---

## Brand & Company

**Company:** Funnelists LLC
**Founder:** Troy Amyett — Salesforce Agentforce Specialist, 9 certifications
**Location:** Hollywood, Florida
**Website:** funnelists.com
**Product name:** Funnelists Resolve (formerly "Support Portal" during development)

**Other Funnelists products** (for cross-sell context):
- **Radar** — Source intelligence & content aggregation
- **Canvas** — AI image generation & creative studio
- **AgentPM** — AI project management
- **LeadGen** — CSV-based lead enrichment

---

*This document provides Claw with full context to conduct market research, develop pricing strategy, create landing pages, and build lead generation campaigns for Funnelists Resolve.*
