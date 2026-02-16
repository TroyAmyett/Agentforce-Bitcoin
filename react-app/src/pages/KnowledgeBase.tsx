import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AIAPI } from '../api/salesforce';
import { Button } from '@funnelists/ui';
import { RichContent } from '../components/RichContent';
import { stripMarkdown } from '../utils/stripMarkdown';
import {
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Lightbulb,
  Loader2,
  Shield,
  Rocket,
  HelpCircle,
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  icon: React.ReactNode;
  items: FAQItem[];
}

const FAQ_DATA: FAQSection[] = [
  {
    title: 'Getting Started',
    icon: <Rocket size={18} />,
    items: [
      {
        question: 'How do I create a support case?',
        answer:
          'Navigate to "My Cases" from the top menu, then click "New Case". Fill in the subject, description, and optionally set a priority and product. You can paste screenshots directly or drag files into the form.',
      },
      {
        question: 'What products are supported?',
        answer:
          'We support all Funnelists products including Radar (deployment management), Canvas (funnel builder), AgentPM (meeting intelligence), Resolve (issue tracking), and LeadGen (lead generation). Select the relevant product when creating a case for faster routing.',
      },
      {
        question: 'How do I track the status of my case?',
        answer:
          'Go to "My Cases" to see all your open and closed cases. Click on any case number to view full details, comments, and attachments. You\'ll see the current status (New, Open, Working, Escalated, or Closed) at the top of the case.',
      },
      {
        question: 'Can I attach files to my case?',
        answer:
          'Yes! When creating or viewing a case, you can attach files by clicking "Attach File" or by dragging files directly onto the page. You can also paste screenshots from your clipboard using Ctrl+V (or Cmd+V on Mac).',
      },
    ],
  },
  {
    title: 'Account & Settings',
    icon: <Shield size={18} />,
    items: [
      {
        question: 'How do I change my password?',
        answer:
          'Go to Settings from the user menu (top right). Under "Change Password", enter your current password and your new password. Passwords must be at least 8 characters with at least one uppercase letter and one number.',
      },
      {
        question: 'I forgot my password. How do I reset it?',
        answer:
          'On the login page, click "Forgot password?" and enter your email address. You\'ll receive a reset link via email. The link is valid for 24 hours.',
      },
      {
        question: 'Who can access my cases?',
        answer:
          'By default, only you can see your cases. If your organization has "Company-Wide" visibility enabled, other team members from your company may also be able to see and comment on your cases.',
      },
    ],
  },
  {
    title: 'Products & Features',
    icon: <Lightbulb size={18} />,
    items: [
      {
        question: 'What is Radar?',
        answer:
          'Radar is our Salesforce deployment management tool. It helps you track, schedule, and roll back metadata deployments across your Salesforce orgs. Key features include deployment history, scheduled deployments, and conflict detection.',
      },
      {
        question: 'What is Canvas?',
        answer:
          'Canvas is our visual funnel builder. Design, collaborate on, and export marketing and sales funnels. Features include drag-and-drop editing, team templates, PDF export, and real-time collaboration.',
      },
      {
        question: 'What is AgentPM?',
        answer:
          'AgentPM is our AI-powered meeting intelligence tool. It captures meeting recordings, generates transcripts, extracts action items, and syncs them directly to Salesforce Tasks. Perfect for keeping your CRM up to date automatically.',
      },
      {
        question: 'How do I suggest a new feature?',
        answer:
          'Visit the Ideas & Feedback page from the navigation menu. You can submit new ideas, browse existing suggestions, and vote on ideas from other users. Our product team reviews the most popular ideas regularly.',
      },
    ],
  },
  {
    title: 'Troubleshooting',
    icon: <HelpCircle size={18} />,
    items: [
      {
        question: 'My deployment failed in Radar. What should I do?',
        answer:
          'First, check the deployment status in Salesforce Setup > Deployment Status for specific error messages. Common issues include: expired Connected App tokens (re-authorize in Radar settings), field-level security conflicts, and dependent metadata missing from the package. If the issue persists, create a support case with the deployment ID and error details.',
      },
      {
        question: 'Canvas PDF exports are empty or corrupted.',
        answer:
          'This usually happens with very large funnels (8+ steps). Try exporting in sections or using Chrome/Edge browser. Also check that popup blockers are not interfering. Our team has a fix in the pipeline for the rendering timeout issue.',
      },
      {
        question: 'AgentPM recordings are not syncing to Salesforce.',
        answer:
          'Verify that your Salesforce Connected App token hasn\'t expired by going to AgentPM Settings > Integrations and re-authorizing if needed. Also ensure the "Task Sync" feature is enabled in your AgentPM workspace settings.',
      },
      {
        question: 'The portal is loading slowly.',
        answer:
          'Try clearing your browser cache and cookies. Test on a different network or device to rule out connectivity issues. If the problem persists, check for browser extensions that might interfere and create a support case with details about which pages are affected.',
      },
    ],
  },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Getting Started': <Rocket size={18} />,
  'Account & Settings': <Shield size={18} />,
  'Products & Features': <Lightbulb size={18} />,
  'Troubleshooting': <HelpCircle size={18} />,
  'Billing': <Shield size={18} />,
  'Other': <BookOpen size={18} />,
};

export function KnowledgeBase() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [dynamicFAQs, setDynamicFAQs] = useState<FAQSection[] | null>(null);
  const [loadingFAQs, setLoadingFAQs] = useState(true);
  const [isDynamic, setIsDynamic] = useState(false);

  useEffect(() => {
    AIAPI.getFAQs()
      .then((result) => {
        const resp = result as { success?: boolean; data?: { faqs?: Array<{ question: string; answer: string; category: string }> } };
        const faqs = resp.data?.faqs;
        if (faqs && faqs.length > 0) {
          // Group by category
          const grouped: Record<string, FAQItem[]> = {};
          for (const faq of faqs) {
            const cat = faq.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ question: faq.question, answer: faq.answer });
          }
          const sections: FAQSection[] = Object.entries(grouped).map(([title, items]) => ({
            title,
            icon: CATEGORY_ICONS[title] || <BookOpen size={18} />,
            items,
          }));
          setDynamicFAQs(sections);
          setIsDynamic(true);
        }
      })
      .catch(() => {
        // Fall back to hardcoded data
      })
      .finally(() => setLoadingFAQs(false));
  }, []);

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleItem = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sourceData = dynamicFAQs || FAQ_DATA;

  const filteredData = searchTerm.trim()
    ? sourceData.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            stripMarkdown(item.answer).toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      })).filter((section) => section.items.length > 0)
    : sourceData;

  return (
    <div>
      <div className="sp-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={22} style={{ color: 'var(--fl-color-primary)' }} />
          <h1 className="sp-page-header__title">Help</h1>
        </div>
        <Link to="/cases/new">
          <Button variant="primary"><Plus size={16} /> Create a Case</Button>
        </Link>
      </div>

      <p style={{ fontSize: 'var(--fl-font-size-sm)', color: 'var(--fl-color-text-secondary)', marginBottom: 'var(--fl-spacing-lg)', maxWidth: '600px' }}>
        Find answers to common questions. If you can&apos;t find what you&apos;re looking for, create a support case and our team will help.
      </p>

      {isDynamic && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          marginBottom: 'var(--fl-spacing-md)',
          borderRadius: 'var(--fl-radius-md)',
          backgroundColor: 'rgba(14, 165, 233, 0.06)',
          border: '1px solid rgba(14, 165, 233, 0.15)',
          fontSize: 'var(--fl-font-size-xs)',
          color: 'var(--fl-color-primary)',
        }}>
          <Brain size={12} />
          AI-generated content
        </div>
      )}

      {/* Search */}
      <div style={{ maxWidth: '480px', marginBottom: 'var(--fl-spacing-xl)', position: 'relative' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search help articles..."
          className="sp-kb-search"
        />
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fl-color-text-muted)', pointerEvents: 'none' }} />
      </div>

      {/* FAQ Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fl-spacing-md)', maxWidth: '800px' }}>
        {loadingFAQs ? (
          <div style={{ textAlign: 'center', padding: 'var(--fl-spacing-xl)', color: 'var(--fl-color-text-secondary)' }}>
            <Loader2 size={20} className="sp-spin" style={{ display: 'inline-block', marginRight: '8px' }} />
            Loading...
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--fl-spacing-2xl)',
            color: 'var(--fl-color-text-secondary)',
            backgroundColor: 'var(--fl-color-bg-elevated)',
            borderRadius: 'var(--fl-radius-lg)',
            border: '1px solid var(--fl-color-border)',
          }}>
            <p>No results found for &quot;{searchTerm}&quot;.</p>
            <p style={{ fontSize: 'var(--fl-font-size-sm)' }}>Try different keywords or <Link to="/cases/new" style={{ color: 'var(--fl-color-primary)' }}>create a support case</Link>.</p>
          </div>
        ) : (
          filteredData.map((section, sIdx) => (
            <div
              key={sIdx}
              style={{
                backgroundColor: 'var(--fl-color-bg-elevated)',
                border: '1px solid var(--fl-color-border)',
                borderRadius: 'var(--fl-radius-lg)',
                overflow: 'hidden',
              }}
            >
              <button
                className="sp-kb-section-header"
                onClick={() => toggleSection(sIdx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--fl-color-primary)' }}>
                  {section.icon}
                  <span style={{ fontWeight: 'var(--fl-font-weight-semibold)', fontSize: 'var(--fl-font-size-md)', color: 'var(--fl-color-text-primary)' }}>
                    {section.title}
                  </span>
                  <span style={{ fontSize: 'var(--fl-font-size-xs)', color: 'var(--fl-color-text-muted)' }}>
                    ({section.items.length})
                  </span>
                </div>
                {expandedSections.has(sIdx) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>

              {expandedSections.has(sIdx) && (
                <div style={{ borderTop: '1px solid var(--fl-color-border)' }}>
                  {section.items.map((item, iIdx) => {
                    const key = `${sIdx}-${iIdx}`;
                    const isExpanded = expandedItems.has(key);
                    return (
                      <div key={iIdx} style={{ borderBottom: iIdx < section.items.length - 1 ? '1px solid var(--fl-color-border)' : 'none' }}>
                        <button
                          className="sp-kb-item-header"
                          onClick={() => toggleItem(key)}
                        >
                          <span>{item.question}</span>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        {isExpanded && (
                          <div className="sp-kb-item-answer">
                            <RichContent content={item.answer} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
