import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AIAPI } from '../api/salesforce';
import {
  MessageCircle,
  X,
  Send,
  Bug,
  Lightbulb,
  ArrowLeft,
  Bot,
  Brain,
  Loader2,
  FileText,
  ThumbsUp,
  BookOpen,
} from 'lucide-react';

type ChatMode = 'welcome' | 'issue' | 'idea' | 'chat';
type AssistantMode = 'builtin' | 'ai-assistant';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
  action?: { label: string; path: string };
}

const ISSUE_GREETING =
  "I'm here to help! Describe what's going on and I'll check if it's a known issue, or help you create a new case with the right priority.";
const IDEA_GREETING =
  "Love that you're thinking about improvements! Tell me your idea and I'll make sure it gets to the right people. You can also browse and vote on existing ideas.";

// Keyword-based response matching for smarter simulated responses
function getAgentResponse(text: string, mode: 'issue' | 'idea'): ChatMessage {
  const lower = text.toLowerCase();
  const id = (Date.now() + 1).toString();
  const timestamp = new Date();

  if (mode === 'idea') {
    if (lower.includes('dark mode') || lower.includes('dark theme')) {
      return { id, sender: 'agent', timestamp, text: "Dark mode is a popular request! I can see others have voted for this too. Would you like to submit this as a formal idea so others can vote on it?", action: { label: 'Go to Ideas', path: '/ideas' } };
    }
    if (lower.includes('integration') || lower.includes('slack') || lower.includes('api')) {
      return { id, sender: 'agent', timestamp, text: "Integration ideas are great for the roadmap. I'll capture this as an Integration idea. You can also check if someone else has already suggested something similar.", action: { label: 'Browse Ideas', path: '/ideas' } };
    }
    return { id, sender: 'agent', timestamp, text: "That's a great suggestion! I've noted it down. You can also submit this on our Ideas board where others can vote and help prioritize it.", action: { label: 'Submit on Ideas Board', path: '/ideas' } };
  }

  // Issue mode responses
  if (lower.includes('deploy') || lower.includes('deployment')) {
    return { id, sender: 'agent', timestamp, text: "Deployment issues can be tricky. A few things to check:\n\n1. Verify your connected app authorization is current\n2. Check if the deployment completed in Salesforce Setup > Deployment Status\n3. Clear your browser cache\n\nIf the issue persists, I'd recommend creating a case so our team can investigate." , action: { label: 'Create a Case', path: '/cases/new' } };
  }
  if (lower.includes('login') || lower.includes('password') || lower.includes('sign in') || lower.includes('access')) {
    return { id, sender: 'agent', timestamp, text: "For login issues, try these steps:\n\n1. Make sure you're using the correct email address\n2. Try resetting your password from the login page\n3. Clear browser cookies for this site\n\nIf you're still locked out, create a case and we'll help you regain access.", action: { label: 'Reset Password', path: '/forgot-password' } };
  }
  if (lower.includes('error') || lower.includes('bug') || lower.includes('broken') || lower.includes('crash')) {
    return { id, sender: 'agent', timestamp, text: "That sounds like it could be a bug. To help us investigate quickly:\n\n1. Note the exact error message (screenshot helps!)\n2. List the steps you took before the error\n3. Check your browser console for any red errors\n\nLet me create a high-priority case for you.", action: { label: 'Create a Case', path: '/cases/new' } };
  }
  if (lower.includes('slow') || lower.includes('performance') || lower.includes('loading')) {
    return { id, sender: 'agent', timestamp, text: "Performance issues can have several causes. Quick checks:\n\n1. Test on a different network/device\n2. Check if it's specific to one page or the whole app\n3. Look for any browser extensions that might interfere\n\nIf the slowness persists, let's create a case with details about when it started." , action: { label: 'Create a Case', path: '/cases/new' } };
  }
  if (lower.includes('export') || lower.includes('pdf') || lower.includes('download')) {
    return { id, sender: 'agent', timestamp, text: "Export issues are sometimes caused by large data sets or browser popup blockers. Try:\n\n1. Allow popups for this site\n2. Try a smaller data range first\n3. Use Chrome or Edge for best compatibility\n\nWant me to create a case for the team to look into?", action: { label: 'Create a Case', path: '/cases/new' } };
  }
  if (lower.includes('how') || lower.includes('help') || lower.includes('guide') || lower.includes('tutorial') || lower.includes('documentation')) {
    return { id, sender: 'agent', timestamp, text: "Great question! I'd suggest checking our Help section first \u2014 it has detailed answers to common questions about getting started, account management, and product-specific troubleshooting. If you can't find what you need, I'll help you create a case.", action: { label: 'Visit Help', path: '/kb' } };
  }

  return { id, sender: 'agent', timestamp, text: "Thanks for sharing those details. I haven't seen this exact issue reported recently, so it may be something new. Let me help you create a support case so our team can investigate properly. Including screenshots will help speed things up!", action: { label: 'Create a Case', path: '/cases/new' } };
}

export function AgentforceChat({ assistantMode = 'builtin' }: { assistantMode?: AssistantMode }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>('welcome');
  const [chatType, setChatType] = useState<'issue' | 'idea'>('issue');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isAI = assistantMode === 'ai-assistant';
  const headerTitle = isAI ? 'AI Assistant' : 'Agentforce';
  const fabLabel = isAI ? 'Ask AI' : 'Ask Agentforce';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing]);

  useEffect(() => {
    if (mode === 'chat' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  const startChat = (selectedMode: 'issue' | 'idea') => {
    const greeting = selectedMode === 'issue' ? ISSUE_GREETING : IDEA_GREETING;
    setChatType(selectedMode);
    setMessages([
      {
        id: '1',
        sender: 'agent',
        text: isAI
          ? "Hi! I'm your AI assistant, here to help with questions about your account, products, and support. What can I help you with?"
          : greeting,
        timestamp: new Date(),
      },
    ]);
    setMode('chat');
    setInput('');
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    if (isAI) {
      // Build conversation history for LLM context
      const history = [...messages, userMsg]
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

      try {
        const result = await AIAPI.chat(text, JSON.stringify(history));
        const reply = (result as { reply?: string })?.reply || 'Sorry, I could not generate a response. Please try again.';
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text: reply,
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'agent',
            text: 'Something went wrong. Please try again in a moment.',
            timestamp: new Date(),
          },
        ]);
      }
      setTyping(false);
    } else {
      // Builtin keyword-based mode
      setTimeout(() => {
        const agentMsg = getAgentResponse(text, chatType);
        setMessages((prev) => [...prev, agentMsg]);
        setTyping(false);
      }, 1200 + Math.random() * 800);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleReset = () => {
    setMode('welcome');
    setMessages([]);
    setInput('');
    setTyping(false);
  };

  const handleAction = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div className="sp-af-chat">
          {/* Header */}
          <div className="sp-af-chat__header">
            <div className="sp-af-chat__header-left">
              {mode === 'chat' && (
                <button
                  className="sp-af-chat__back"
                  onClick={handleReset}
                  aria-label="Back"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              {isAI ? <Brain size={20} className="sp-af-chat__header-icon" /> : <Bot size={20} className="sp-af-chat__header-icon" />}
              <span className="sp-af-chat__header-title">{headerTitle}</span>
            </div>
            <button
              className="sp-af-chat__close"
              onClick={handleClose}
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="sp-af-chat__body">
            {mode === 'welcome' && (
              <div className="sp-af-chat__welcome">
                <div className="sp-af-chat__welcome-icon">
                  <Bot size={32} />
                </div>
                <h3 className="sp-af-chat__welcome-title">
                  How can I help you today?
                </h3>
                <p className="sp-af-chat__welcome-sub">
                  I can troubleshoot issues or capture your great ideas.
                </p>
                <div className="sp-af-chat__options">
                  <button
                    className="sp-af-chat__option sp-af-chat__option--issue"
                    onClick={() => startChat('issue')}
                  >
                    <Bug size={20} />
                    <div>
                      <div className="sp-af-chat__option-label">
                        I have an issue
                      </div>
                      <div className="sp-af-chat__option-desc">
                        Report a problem or get help
                      </div>
                    </div>
                  </button>
                  <button
                    className="sp-af-chat__option sp-af-chat__option--idea"
                    onClick={() => startChat('idea')}
                  >
                    <Lightbulb size={20} />
                    <div>
                      <div className="sp-af-chat__option-label">
                        I have an idea
                      </div>
                      <div className="sp-af-chat__option-desc">
                        Share a suggestion or feature request
                      </div>
                    </div>
                  </button>
                </div>

                {/* Quick links */}
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button
                    className="sp-af-chat__quicklink"
                    onClick={() => handleAction('/cases')}
                  >
                    <FileText size={14} /> My Cases
                  </button>
                  <button
                    className="sp-af-chat__quicklink"
                    onClick={() => handleAction('/ideas')}
                  >
                    <ThumbsUp size={14} /> Ideas Board
                  </button>
                  <button
                    className="sp-af-chat__quicklink"
                    onClick={() => handleAction('/kb')}
                  >
                    <BookOpen size={14} /> Help Center
                  </button>
                </div>
              </div>
            )}

            {mode === 'chat' && (
              <div className="sp-af-chat__messages">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    <div
                      className={`sp-af-chat__msg sp-af-chat__msg--${msg.sender}`}
                    >
                      {msg.sender === 'agent' && (
                        <div className="sp-af-chat__msg-avatar">
                          <Bot size={14} />
                        </div>
                      )}
                      <div className="sp-af-chat__msg-bubble">{msg.text}</div>
                    </div>
                    {msg.action && msg.sender === 'agent' && (
                      <div style={{ marginLeft: '36px', marginTop: '6px', marginBottom: '8px' }}>
                        <button
                          className="sp-af-chat__action-btn"
                          onClick={() => handleAction(msg.action!.path)}
                        >
                          {msg.action.label}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {typing && (
                  <div className="sp-af-chat__msg sp-af-chat__msg--agent">
                    <div className="sp-af-chat__msg-avatar">
                      <Bot size={14} />
                    </div>
                    <div className="sp-af-chat__msg-bubble sp-af-chat__msg-bubble--typing">
                      <Loader2 size={14} className="sp-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input (chat mode only) */}
          {mode === 'chat' && (
            <div className="sp-af-chat__input-area">
              <textarea
                ref={inputRef}
                className="sp-af-chat__input"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="sp-af-chat__send"
                onClick={handleSend}
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        className={`sp-af-fab ${open ? 'sp-af-fab--open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={fabLabel}
      >
        {open ? (
          <X size={22} />
        ) : (
          <>
            {isAI ? <Brain size={20} /> : <MessageCircle size={20} />}
            <span className="sp-af-fab__label">{fabLabel}</span>
          </>
        )}
      </button>
    </>
  );
}
