/**
 * Mock data layer for local development (no Salesforce connection).
 * Simulates Apex @RemoteAction responses with in-memory state.
 * Demo data is themed around Funnelists products: Radar, Canvas, AgentPM.
 */

import type { SPResponse } from './salesforce';

// ─── In-memory state ──────────────────────────────────────────

interface MockUser {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  accountId: string;
  accountName: string;
  status: string;
  enabled: boolean;
  lastLogin: string;
  registrationDate: string;
}

interface MockCase {
  id: string;
  caseNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  origin: string;
  type: string;
  product: string;
  isClosed: boolean;
  contactId: string;
  contactName: string;
  accountId: string;
  accountName: string;
  createdDate: string;
  lastModifiedDate: string;
  closedDate?: string;
  comments: MockComment[];
  attachments: MockAttachment[];
}

interface MockComment {
  id: string;
  body: string;
  createdDate: string;
  author: string;
}

interface MockAttachment {
  id: string;
  title: string;
  extension: string;
  size: number;
  createdDate: string;
}

interface MockIdea {
  id: string;
  ideaNumber: string;
  title: string;
  description: string;
  category: string;
  status: string;
  votes: number;
  votedContactIds: string[];
  product: string;
  published: boolean;
  contactId: string;
  author: string;
  accountName: string;
  createdDate: string;
}

let currentUserId: string | null = null;
let nextCaseNum = 1008;
let nextIdeaNum = 5;
let nextId = 200;

// Portal config (admin-editable)
let portalConfig: Record<string, unknown> = {
  showProduct: true,
  productOptions: 'Radar,Canvas,AgentPM,Resolve,LeadGen',
  showPriority: true,
  showType: false,
  showAdminInPortal: true,
  agentforce: {
    enabled: true,
    mode: 'builtin',
    scriptUrl: '',
    orgId: '',
    deploymentName: '',
    siteUrl: '',
    scrtUrl: '',
  },
};

const uid = () => `mock-${++nextId}`;

// ─── Seed data (Funnelists themed) ────────────────────────────

const users: MockUser[] = [
  {
    id: 'mock-user-1',
    firstName: 'Sarah',
    lastName: 'Chen',
    name: 'Sarah Chen',
    email: 'sarah@funnelists.com',
    passwordHash: simpleHash('Admin123!'),
    role: 'Super Admin',
    accountId: 'mock-acct-1',
    accountName: 'Funnelists',
    status: 'Active',
    enabled: true,
    lastLogin: new Date().toISOString(),
    registrationDate: '2025-09-01T00:00:00.000Z',
  },
  {
    id: 'mock-user-2',
    firstName: 'Marcus',
    lastName: 'Rivera',
    name: 'Marcus Rivera',
    email: 'marcus@techflow.io',
    passwordHash: simpleHash('User1234!'),
    role: 'User',
    accountId: 'mock-acct-2',
    accountName: 'TechFlow Solutions',
    status: 'Active',
    enabled: true,
    lastLogin: new Date(Date.now() - 3600000).toISOString(),
    registrationDate: '2025-11-10T00:00:00.000Z',
  },
  {
    id: 'mock-user-3',
    firstName: 'Priya',
    lastName: 'Patel',
    name: 'Priya Patel',
    email: 'priya@brightlabs.co',
    passwordHash: simpleHash('User1234!'),
    role: 'Portal Admin',
    accountId: 'mock-acct-3',
    accountName: 'BrightLabs',
    status: 'Active',
    enabled: true,
    lastLogin: new Date(Date.now() - 86400000).toISOString(),
    registrationDate: '2025-10-22T00:00:00.000Z',
  },
  {
    id: 'mock-user-4',
    firstName: 'James',
    lastName: 'Okafor',
    name: 'James Okafor',
    email: 'james@novanet.dev',
    passwordHash: simpleHash('User1234!'),
    role: 'User',
    accountId: 'mock-acct-4',
    accountName: 'NovaNet',
    status: 'Active',
    enabled: true,
    lastLogin: new Date(Date.now() - 172800000).toISOString(),
    registrationDate: '2025-12-05T00:00:00.000Z',
  },
  {
    id: 'mock-user-5',
    firstName: 'Emily',
    lastName: 'Tanaka',
    name: 'Emily Tanaka',
    email: 'emily@solvecraft.io',
    passwordHash: simpleHash('User1234!'),
    role: 'User',
    accountId: 'mock-acct-5',
    accountName: 'SolveCraft',
    status: 'Pending',
    enabled: false,
    lastLogin: '',
    registrationDate: '2026-01-28T00:00:00.000Z',
  },
  {
    id: 'mock-user-6',
    firstName: 'David',
    lastName: 'Kim',
    name: 'David Kim',
    email: 'david@pixelforge.com',
    passwordHash: simpleHash('User1234!'),
    role: 'User',
    accountId: 'mock-acct-6',
    accountName: 'PixelForge',
    status: 'Inactive',
    enabled: false,
    lastLogin: '2025-11-15T00:00:00.000Z',
    registrationDate: '2025-10-01T00:00:00.000Z',
  },
];

const cases: MockCase[] = [
  {
    id: 'mock-case-1',
    caseNumber: '00001000',
    subject: 'Radar dashboard not loading after deploy',
    description: 'After deploying our latest Salesforce metadata package via Radar, the dashboard view returns a blank white screen. Console shows a 403 on the analytics API endpoint. This started after the 2.4.1 update.',
    status: 'New',
    priority: 'High',
    origin: 'Support Portal',
    type: 'Problem',
    product: 'Radar',
    isClosed: false,
    contactId: 'mock-user-1',
    contactName: 'Sarah Chen',
    accountId: 'mock-acct-1',
    accountName: 'Funnelists',
    createdDate: new Date(Date.now() - 7200000).toISOString(),
    lastModifiedDate: new Date(Date.now() - 3600000).toISOString(),
    comments: [
      {
        id: 'mock-comment-1',
        body: 'I\'ve verified this happens in both Chrome and Firefox. The deploy itself completes successfully — it\'s only the dashboard that fails to render.',
        createdDate: new Date(Date.now() - 5400000).toISOString(),
        author: 'Sarah Chen',
      },
      {
        id: 'mock-comment-2',
        body: 'Thanks Sarah. We\'ve identified the issue — a permissions change in 2.4.1 requires the Connected App to be re-authorized. We\'re pushing a hotfix that handles this automatically.',
        createdDate: new Date(Date.now() - 3600000).toISOString(),
        author: 'Support Team',
      },
    ],
    attachments: [
      {
        id: 'mock-att-1',
        title: 'radar-console-errors',
        extension: 'png',
        size: 312400,
        createdDate: new Date(Date.now() - 5400000).toISOString(),
      },
    ],
  },
  {
    id: 'mock-case-2',
    caseNumber: '00001001',
    subject: 'Canvas: export funnel to PDF not working',
    description: 'When I click "Export to PDF" on a completed funnel in Canvas, the download starts but the file is 0 bytes. This happens for all funnels, not just new ones.',
    status: 'Open',
    priority: 'Medium',
    origin: 'Support Portal',
    type: 'Bug',
    product: 'Canvas',
    isClosed: false,
    contactId: 'mock-user-1',
    contactName: 'Sarah Chen',
    accountId: 'mock-acct-1',
    accountName: 'Funnelists',
    createdDate: new Date(Date.now() - 259200000).toISOString(),
    lastModifiedDate: new Date(Date.now() - 86400000).toISOString(),
    comments: [
      {
        id: 'mock-comment-3',
        body: 'We can reproduce this. It appears the PDF rendering service times out on funnels with more than 8 steps. Working on a fix for the next release.',
        createdDate: new Date(Date.now() - 86400000).toISOString(),
        author: 'Support Team',
      },
    ],
    attachments: [],
  },
  {
    id: 'mock-case-3',
    caseNumber: '00001002',
    subject: 'AgentPM recording playback stalls on Firefox',
    description: 'Meeting recordings captured with AgentPM play fine in Chrome but stall at random points in Firefox 124. Audio continues but video freezes. Seeking bar also becomes unresponsive.',
    status: 'Open',
    priority: 'Medium',
    origin: 'Support Portal',
    type: 'Bug',
    product: 'AgentPM',
    isClosed: false,
    contactId: 'mock-user-2',
    contactName: 'Marcus Rivera',
    accountId: 'mock-acct-2',
    accountName: 'TechFlow Solutions',
    createdDate: new Date(Date.now() - 432000000).toISOString(),
    lastModifiedDate: new Date(Date.now() - 172800000).toISOString(),
    comments: [],
    attachments: [
      {
        id: 'mock-att-2',
        title: 'firefox-playback-debug-log',
        extension: 'txt',
        size: 48200,
        createdDate: new Date(Date.now() - 432000000).toISOString(),
      },
    ],
  },
  {
    id: 'mock-case-4',
    caseNumber: '00001003',
    subject: 'Request: Radar deployment rollback feature',
    description: 'It would be incredibly helpful to have a one-click rollback option in Radar after a deployment. Currently if something goes wrong we have to manually revert metadata changes.',
    status: 'Open',
    priority: 'Low',
    origin: 'Support Portal',
    type: 'Feature Request',
    product: 'Radar',
    isClosed: false,
    contactId: 'mock-user-3',
    contactName: 'Priya Patel',
    accountId: 'mock-acct-3',
    accountName: 'BrightLabs',
    createdDate: new Date(Date.now() - 604800000).toISOString(),
    lastModifiedDate: new Date(Date.now() - 604800000).toISOString(),
    comments: [],
    attachments: [],
  },
  {
    id: 'mock-case-5',
    caseNumber: '00001004',
    subject: 'Canvas template library not syncing across team',
    description: 'We saved several funnel templates to our shared Canvas library but other team members can\'t see them. The templates show up under "My Templates" but not under "Team Templates".',
    status: 'Closed',
    priority: 'Medium',
    origin: 'Support Portal',
    type: 'Problem',
    product: 'Canvas',
    isClosed: true,
    contactId: 'mock-user-1',
    contactName: 'Sarah Chen',
    accountId: 'mock-acct-1',
    accountName: 'Funnelists',
    createdDate: new Date(Date.now() - 1209600000).toISOString(),
    lastModifiedDate: new Date(Date.now() - 864000000).toISOString(),
    closedDate: new Date(Date.now() - 864000000).toISOString(),
    comments: [
      {
        id: 'mock-comment-4',
        body: 'This was caused by a sharing permission not being set correctly. We\'ve updated the template save flow to automatically set team visibility when saving to a shared library. Fixed in Canvas 3.2.0.',
        createdDate: new Date(Date.now() - 864000000).toISOString(),
        author: 'Support Team',
      },
    ],
    attachments: [],
  },
  {
    id: 'mock-case-6',
    caseNumber: '00001005',
    subject: 'AgentPM action items not syncing to Salesforce Tasks',
    description: 'AgentPM captures action items from meetings correctly, but the Salesforce Task sync has stopped working. Tasks used to appear automatically but haven\'t synced in about a week.',
    status: 'Closed',
    priority: 'High',
    origin: 'Support Portal',
    type: 'Problem',
    product: 'AgentPM',
    isClosed: true,
    contactId: 'mock-user-4',
    contactName: 'James Okafor',
    accountId: 'mock-acct-4',
    accountName: 'NovaNet',
    createdDate: new Date(Date.now() - 1814400000).toISOString(),
    lastModifiedDate: new Date(Date.now() - 1296000000).toISOString(),
    closedDate: new Date(Date.now() - 1296000000).toISOString(),
    comments: [
      {
        id: 'mock-comment-5',
        body: 'Hi James — the Salesforce Connected App token had expired. We\'ve added auto-refresh logic in AgentPM 1.5.2 to prevent this. Please re-authorize the connection in Settings > Integrations.',
        createdDate: new Date(Date.now() - 1296000000).toISOString(),
        author: 'Support Team',
      },
    ],
    attachments: [],
  },
  {
    id: 'mock-case-7',
    caseNumber: '00001006',
    subject: 'Radar: scheduled deployments running at wrong time',
    description: 'I set up a scheduled deployment for 2:00 AM PST but it executed at 2:00 AM UTC instead. The timezone selector in Radar seems to be ignored.',
    status: 'New',
    priority: 'High',
    origin: 'Support Portal',
    type: 'Bug',
    product: 'Radar',
    isClosed: false,
    contactId: 'mock-user-2',
    contactName: 'Marcus Rivera',
    accountId: 'mock-acct-2',
    accountName: 'TechFlow Solutions',
    createdDate: new Date(Date.now() - 14400000).toISOString(),
    lastModifiedDate: new Date(Date.now() - 14400000).toISOString(),
    comments: [],
    attachments: [
      {
        id: 'mock-att-3',
        title: 'schedule-config-screenshot',
        extension: 'png',
        size: 186300,
        createdDate: new Date(Date.now() - 14400000).toISOString(),
      },
    ],
  },
];

const ideas: MockIdea[] = [
  {
    id: 'mock-idea-1',
    ideaNumber: 'IDEA-00001',
    title: 'Dark mode for the portal',
    description: 'It would be great to have a dark mode option for the support portal, especially for working late at night. Could toggle in settings.',
    category: 'UX',
    status: 'Under Review',
    votes: 12,
    votedContactIds: ['mock-user-2', 'mock-user-3'],
    product: '',
    published: true,
    contactId: 'mock-user-1',
    author: 'Sarah Chen',
    accountName: 'Funnelists',
    createdDate: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: 'mock-idea-2',
    ideaNumber: 'IDEA-00002',
    title: 'Slack integration for case updates',
    description: 'Receive case status changes directly in our Slack channels. Would love a webhook or native Slack app integration.',
    category: 'Integration',
    status: 'Planned',
    votes: 24,
    votedContactIds: ['mock-user-1', 'mock-user-2', 'mock-user-4'],
    product: 'Radar',
    published: true,
    contactId: 'mock-user-3',
    author: 'Priya Patel',
    accountName: 'BrightLabs',
    createdDate: new Date(Date.now() - 1209600000).toISOString(),
  },
  {
    id: 'mock-idea-3',
    ideaNumber: 'IDEA-00003',
    title: 'Bulk close resolved cases',
    description: 'Allow selecting multiple cases and closing them in batch. Would save a lot of time for admins managing large volumes.',
    category: 'Feature',
    status: 'New',
    votes: 8,
    votedContactIds: ['mock-user-1'],
    product: '',
    published: true,
    contactId: 'mock-user-4',
    author: 'James Okafor',
    accountName: 'NovaNet',
    createdDate: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'mock-idea-4',
    ideaNumber: 'IDEA-00004',
    title: 'Canvas template marketplace',
    description: 'A community marketplace where users can share and discover funnel templates. Would accelerate onboarding for new Canvas users.',
    category: 'Feature',
    status: 'Shipped',
    votes: 31,
    votedContactIds: ['mock-user-1', 'mock-user-2', 'mock-user-3', 'mock-user-4'],
    product: 'Canvas',
    published: true,
    contactId: 'mock-user-2',
    author: 'Marcus Rivera',
    accountName: 'TechFlow Solutions',
    createdDate: new Date(Date.now() - 2592000000).toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return 'hash_' + Math.abs(hash).toString(36);
}

function ok<T>(data: T): SPResponse<T> {
  return { success: true, data };
}

function err(message: string): SPResponse {
  return { success: false, error: message };
}

function delay(ms = 300): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 200));
}

// ─── Route handler ────────────────────────────────────────────

export async function handleMockCall(
  method: string,
  params: unknown[],
): Promise<SPResponse> {
  await delay();

  switch (method) {
    case 'login':
      return mockLogin(params[0] as string, params[1] as string);
    case 'register':
      return mockRegister(
        params[0] as string, params[1] as string,
        params[2] as string, params[3] as string, params[4] as string,
      );
    case 'logout':
      currentUserId = null;
      return ok('Logged out successfully.');
    case 'getCurrentUser':
      return mockGetCurrentUser();
    case 'changePassword':
      return mockChangePassword(params[0] as string, params[1] as string, params[2] as string);
    case 'resetPasswordRequest':
      return ok('If that email exists, a reset link has been sent.');
    case 'resetPassword':
      return ok('Password has been reset. You can now log in.');
    case 'getCases':
      return mockGetCases(params[0] as string, params[1] as string, params[2] as number);
    case 'getCaseDetail':
      return mockGetCaseDetail(params[0] as string, params[1] as string);
    case 'createCase':
      return mockCreateCase(params[0] as string, params[1] as string, params[2] as string, params[3] as string, params[4] as string, params[5] as string);
    case 'addComment':
      return mockAddComment(params[0] as string, params[1] as string, params[2] as string);
    case 'uploadAttachment':
      return mockUploadAttachment(params[0] as string, params[1] as string, params[2] as string);
    case 'getAttachmentContent':
      return mockGetAttachmentContent(params[0] as string, params[1] as string);
    case 'closeCase':
      return mockCloseCase(params[0] as string, params[1] as string);
    case 'getPortalUsers':
      return mockGetPortalUsers(params[0] as number, params[1] as string);
    case 'getPortalStats':
      return mockGetPortalStats();
    case 'getPortalSettings':
      return mockGetPortalSettings();
    case 'updateUserStatus':
      return mockUpdateUserStatus(params[0] as string, params[1] as string);
    case 'updateUserRole':
      return mockUpdateUserRole(params[0] as string, params[1] as string);
    case 'fetchWebsite':
      return ok({ html: '<html><body>Mock</body></html>', cssContents: [], cssUrls: [], favicon: null, sourceUrl: params[0] });
    case 'saveTheme':
      return ok('Theme saved.');
    case 'resetTheme':
      return ok('Theme reset to defaults.');
    case 'getTheme':
      return ok({ themeJson: null, logoUrl: null, companyName: 'Funnelists' });
    // Ideas API
    case 'getIdeas':
      return mockGetIdeas(params[0] as string, params[1] as string, params[2] as number);
    case 'createIdea':
      return mockCreateIdea(params[0] as string, params[1] as string, params[2] as string, params[3] as string, params[4] as string);
    case 'voteForIdea':
      return mockVoteForIdea(params[0] as string, params[1] as string);
    case 'updateIdeaStatus':
      return mockUpdateIdeaStatus(params[0] as string, params[1] as string);
    case 'toggleIdeaPublished':
      return mockToggleIdeaPublished(params[0] as string, params[1] as boolean);
    case 'savePortalSettings':
      return mockSavePortalSettings(params[0] as string);
    case 'getPortalConfig':
      return mockGetPortalConfig();
    // AI API
    case 'chat':
      return mockChat(params[0] as string);
    case 'generateFAQs':
      return mockGenerateFAQs(params[0] as string, params[1] as string);
    case 'getFAQs':
      return mockGetFAQs();
    case 'getAdminFAQs':
      return mockGetAdminFAQs();
    case 'updateFAQ':
      return mockUpdateFAQ(params[0] as string, params[1] as string, params[2] as string, params[3] as string, params[4] as boolean);
    case 'deleteFAQ':
      return mockDeleteFAQ(params[0] as string);
    default:
      return err(`Unknown mock method: ${method}`);
  }
}

// ─── Auth mocks ───────────────────────────────────────────────

function mockLogin(email: string, password: string): SPResponse {
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || simpleHash(password) !== user.passwordHash) {
    return err('Invalid email or password.');
  }
  if (!user.enabled || user.status !== 'Active') {
    return err('Account is not active.');
  }
  user.lastLogin = new Date().toISOString();
  currentUserId = user.id;
  return ok({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    username: user.email,
    role: user.role,
    accountId: user.accountId,
    accountName: user.accountName,
    lastLogin: user.lastLogin,
    sessionToken: `${user.id}---mock-session---${Date.now()}`,
  });
}

function mockRegister(
  firstName: string, lastName: string, email: string, password: string, company: string,
): SPResponse {
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return err('An account with this email already exists.');
  }
  const acctId = uid();
  const user: MockUser = {
    id: uid(),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email,
    passwordHash: simpleHash(password),
    role: 'User',
    accountId: acctId,
    accountName: company || 'Personal',
    status: 'Active',
    enabled: true,
    lastLogin: new Date().toISOString(),
    registrationDate: new Date().toISOString(),
  };
  users.push(user);
  currentUserId = user.id;
  return ok({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    username: user.email,
    role: user.role,
    accountId: user.accountId,
    accountName: user.accountName,
    sessionToken: `${user.id}---mock-session---${Date.now()}`,
  });
}

function mockGetCurrentUser(): SPResponse {
  if (!currentUserId) return err('No active session.');
  const user = users.find((u) => u.id === currentUserId);
  if (!user) return err('User not found.');
  return ok({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    username: user.email,
    role: user.role,
    accountId: user.accountId,
    accountName: user.accountName,
    lastLogin: user.lastLogin,
  });
}

function mockChangePassword(contactId: string, currentPassword: string, newPassword: string): SPResponse {
  const user = users.find((u) => u.id === contactId);
  if (!user) return err('Invalid user session.');
  if (simpleHash(currentPassword) !== user.passwordHash) return err('Current password is incorrect.');
  if (newPassword.length < 8) return err('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(newPassword)) return err('Password must contain at least one uppercase letter.');
  if (!/[0-9]/.test(newPassword)) return err('Password must contain at least one number.');
  user.passwordHash = simpleHash(newPassword);
  return ok('Password changed successfully.');
}

// ─── Case mocks ───────────────────────────────────────────────

function mockGetCases(contactId: string, statusFilter: string, page: number): SPResponse {
  let filtered = cases.filter((c) => c.contactId === contactId);

  if (statusFilter && statusFilter !== 'All') {
    if (statusFilter === 'Open') filtered = filtered.filter((c) => !c.isClosed);
    else if (statusFilter === 'Closed') filtered = filtered.filter((c) => c.isClosed);
    else filtered = filtered.filter((c) => c.status === statusFilter);
  }

  const pageSize = 20;
  const pg = Math.max(1, page || 1);
  const start = (pg - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  const openCount = cases.filter((c) => c.contactId === contactId && !c.isClosed).length;
  const closedCount = cases.filter((c) => c.contactId === contactId && c.isClosed).length;

  return ok({
    cases: paginated.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      subject: c.subject,
      status: c.status,
      priority: c.priority,
      product: c.product,
      createdDate: c.createdDate,
      lastModifiedDate: c.lastModifiedDate,
      contactName: c.contactName,
      accountName: c.accountName,
    })),
    totalRecords: filtered.length,
    pageSize,
    currentPage: pg,
    totalPages: Math.ceil(filtered.length / pageSize) || 1,
    stats: {
      open: openCount,
      closed: closedCount,
      total: openCount + closedCount,
      newToday: cases.filter((c) => c.contactId === contactId && c.createdDate.startsWith(new Date().toISOString().slice(0, 10))).length,
    },
  });
}

function mockGetCaseDetail(contactId: string, caseId: string): SPResponse {
  const c = cases.find((cs) => cs.id === caseId && cs.contactId === contactId);
  if (!c) return err('Case not found or access denied.');

  return ok({
    case: {
      id: c.id,
      caseNumber: c.caseNumber,
      subject: c.subject,
      status: c.status,
      priority: c.priority,
      description: c.description,
      product: c.product,
      createdDate: c.createdDate,
      lastModifiedDate: c.lastModifiedDate,
      closedDate: c.closedDate,
      origin: c.origin,
      type: c.type,
      isClosed: c.isClosed,
      contactName: c.contactName,
      accountName: c.accountName,
    },
    comments: c.comments,
    attachments: c.attachments,
  });
}

function mockCreateCase(contactId: string, subject: string, description: string, priority: string, product: string, caseType: string): SPResponse {
  const user = users.find((u) => u.id === contactId);
  if (!user) return err('Invalid user session.');

  const newCase: MockCase = {
    id: uid(),
    caseNumber: String(nextCaseNum++).padStart(8, '0'),
    subject,
    description,
    status: 'New',
    priority: priority || 'Medium',
    origin: 'Support Portal',
    type: caseType || '',
    product: product || '',
    isClosed: false,
    contactId,
    contactName: user.name,
    accountId: user.accountId,
    accountName: user.accountName,
    createdDate: new Date().toISOString(),
    lastModifiedDate: new Date().toISOString(),
    comments: [],
    attachments: [],
  };
  cases.unshift(newCase);

  return ok({
    id: newCase.id,
    caseNumber: newCase.caseNumber,
    subject: newCase.subject,
    status: newCase.status,
    priority: newCase.priority,
    createdDate: newCase.createdDate,
  });
}

function mockAddComment(contactId: string, caseId: string, body: string): SPResponse {
  const c = cases.find((cs) => cs.id === caseId);
  if (!c) return err('Case not found.');
  const user = users.find((u) => u.id === contactId);

  const comment: MockComment = {
    id: uid(),
    body: `${user?.name || 'Unknown'}: ${body}`,
    createdDate: new Date().toISOString(),
    author: user?.name || 'Unknown',
  };
  c.comments.push(comment);

  return ok(comment);
}

function mockUploadAttachment(contactId: string, caseId: string, fileName: string): SPResponse {
  const c = cases.find((cs) => cs.id === caseId);
  if (!c) return err('Case not found.');

  const parts = fileName.split('.');
  const ext = parts.length > 1 ? parts.pop()! : '';
  const title = parts.join('.');

  const att: MockAttachment = {
    id: uid(),
    title,
    extension: ext,
    size: Math.floor(Math.random() * 500000) + 10000,
    createdDate: new Date().toISOString(),
  };
  c.attachments.push(att);

  return ok({ id: att.id, title: att.title, createdDate: att.createdDate });
}

function mockGetAttachmentContent(_contactId: string, contentDocumentId: string): SPResponse {
  for (const c of cases) {
    const att = c.attachments.find((a) => a.id === contentDocumentId);
    if (att) {
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(att.extension.toLowerCase());
      // 1x1 transparent PNG placeholder for images, text for others
      const base64Data = isImage
        ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        : btoa('Mock file content for ' + att.title + '.' + att.extension);
      return ok({
        title: att.title,
        extension: att.extension,
        size: att.size,
        base64Data,
      });
    }
  }
  return err('Attachment not found.');
}

function mockCloseCase(contactId: string, caseId: string): SPResponse {
  const c = cases.find((cs) => cs.id === caseId && cs.contactId === contactId);
  if (!c) return err('Case not found or access denied.');
  if (c.isClosed) return err('Case is already closed.');

  c.status = 'Closed';
  c.isClosed = true;
  c.closedDate = new Date().toISOString();
  c.lastModifiedDate = new Date().toISOString();

  return ok('Case closed successfully.');
}

// ─── Ideas mocks ─────────────────────────────────────────────

function mockGetIdeas(contactId: string, categoryFilter: string, page: number): SPResponse {
  let filtered = ideas;
  if (categoryFilter && categoryFilter !== 'All') {
    filtered = ideas.filter((i) => i.category === categoryFilter);
  }

  // Sort by votes desc
  filtered = [...filtered].sort((a, b) => b.votes - a.votes);

  const pageSize = 20;
  const pg = Math.max(1, page || 1);
  const start = (pg - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  return ok({
    ideas: paginated.map((i) => ({
      id: i.id,
      ideaNumber: i.ideaNumber,
      title: i.title,
      description: i.description,
      category: i.category,
      status: i.status,
      votes: i.votes,
      voted: i.votedContactIds.includes(contactId),
      product: i.product,
      published: i.published,
      author: i.author,
      accountName: i.accountName,
      createdDate: i.createdDate,
    })),
    totalRecords: filtered.length,
    pageSize,
    currentPage: pg,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
}

function mockCreateIdea(contactId: string, title: string, description: string, category: string, product: string): SPResponse {
  const user = users.find((u) => u.id === contactId);
  if (!user) return err('Invalid user session.');

  const idea: MockIdea = {
    id: uid(),
    ideaNumber: `IDEA-${String(++nextIdeaNum).padStart(5, '0')}`,
    title,
    description,
    category: category || 'Feature',
    status: 'New',
    votes: 1,
    votedContactIds: [contactId],
    product: product || '',
    published: true,
    contactId,
    author: user.name,
    accountName: user.accountName,
    createdDate: new Date().toISOString(),
  };
  ideas.unshift(idea);

  return ok({
    id: idea.id,
    ideaNumber: idea.ideaNumber,
    title: idea.title,
  });
}

function mockVoteForIdea(contactId: string, ideaId: string): SPResponse {
  const idea = ideas.find((i) => i.id === ideaId);
  if (!idea) return err('Idea not found.');

  const alreadyVoted = idea.votedContactIds.includes(contactId);
  if (alreadyVoted) {
    idea.votedContactIds = idea.votedContactIds.filter((id) => id !== contactId);
    idea.votes = Math.max(0, idea.votes - 1);
  } else {
    idea.votedContactIds.push(contactId);
    idea.votes += 1;
  }

  return ok({
    voted: !alreadyVoted,
    votes: idea.votes,
  });
}

function mockUpdateIdeaStatus(ideaId: string, status: string): SPResponse {
  const idea = ideas.find((i) => i.id === ideaId);
  if (!idea) return err('Idea not found.');
  idea.status = status;
  return ok('Idea status updated.');
}

function mockToggleIdeaPublished(ideaId: string, published: boolean): SPResponse {
  const idea = ideas.find((i) => i.id === ideaId);
  if (!idea) return err('Idea not found.');
  idea.published = published;
  return ok({ published });
}

// ─── Admin mocks ──────────────────────────────────────────────

function mockGetPortalUsers(page: number, searchTerm: string): SPResponse {
  let filtered = users;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = users.filter(
      (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  }
  const pageSize = 25;
  const pg = Math.max(1, page || 1);
  const start = (pg - 1) * pageSize;

  return ok({
    users: filtered.slice(start, start + pageSize).map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      name: u.name,
      email: u.email,
      username: u.email,
      enabled: u.enabled,
      status: u.status,
      role: u.role,
      lastLogin: u.lastLogin,
      registrationDate: u.registrationDate,
      accountName: u.accountName,
    })),
    totalRecords: filtered.length,
    pageSize,
    currentPage: pg,
    totalPages: Math.ceil(filtered.length / pageSize) || 1,
  });
}

function mockGetPortalStats(): SPResponse {
  const activeUsers = users.filter((u) => u.status === 'Active').length;
  const pendingUsers = users.filter((u) => u.status === 'Pending').length;
  const openCases = cases.filter((c) => !c.isClosed).length;
  const closedCases = cases.filter((c) => c.isClosed).length;
  return ok({
    users: {
      total: users.length,
      active: activeUsers,
      pending: pendingUsers,
      inactive: users.length - activeUsers - pendingUsers,
    },
    cases: {
      total: cases.length,
      open: openCases,
      closed: closedCases,
    },
  });
}

function mockGetPortalSettings(): SPResponse {
  const af = portalConfig.agentforce as Record<string, unknown> | undefined;
  return ok({
    registrationMode: 'Invite_Only',
    caseVisibility: 'User_Only',
    sessionDuration: 30,
    supportEmail: 'support@funnelists.com',
    supportPhone: '(415) 555-0142',
    agentforceEnabled: af?.enabled ?? true,
    portalConfigJson: JSON.stringify(portalConfig),
  });
}

function mockSavePortalSettings(configJson: string): SPResponse {
  try {
    portalConfig = JSON.parse(configJson);
    return ok('Portal settings saved.');
  } catch {
    return err('Invalid config JSON.');
  }
}

function mockGetPortalConfig(): SPResponse {
  return ok({
    portalConfigJson: JSON.stringify(portalConfig),
  });
}

function mockUpdateUserStatus(contactId: string, status: string): SPResponse {
  const user = users.find((u) => u.id === contactId);
  if (!user) return err('User not found.');
  user.status = status;
  user.enabled = status === 'Active';
  return ok('User status updated.');
}

function mockUpdateUserRole(contactId: string, role: string): SPResponse {
  const user = users.find((u) => u.id === contactId);
  if (!user) return err('User not found.');
  user.role = role;
  return ok('User role updated.');
}

// ─── AI mocks ────────────────────────────────────────────────

interface MockFAQ {
  id: string;
  faqNumber: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  published: boolean;
  sourceDocument: string;
  createdDate: string;
}

let mockFAQs: MockFAQ[] = [
  {
    id: 'faq-001', faqNumber: 'FAQ-00001',
    question: 'How do I create a support case?',
    answer: 'Navigate to "My Cases" from the top menu, then click "New Case". Fill in the subject, description, and optionally set a priority and product.',
    category: 'Getting Started', sortOrder: 1, published: true, sourceDocument: 'Product Guide', createdDate: '2026-02-01T10:00:00Z',
  },
  {
    id: 'faq-002', faqNumber: 'FAQ-00002',
    question: 'What products are supported?',
    answer: 'We support Radar (source intelligence), Canvas (AI image generation), AgentPM (AI project management), and LeadGen (lead enrichment).',
    category: 'Getting Started', sortOrder: 2, published: true, sourceDocument: 'Product Guide', createdDate: '2026-02-01T10:00:00Z',
  },
  {
    id: 'faq-003', faqNumber: 'FAQ-00003',
    question: 'How do I reset my password?',
    answer: 'Click "Forgot password?" on the login page and enter your email. You\'ll receive a reset link valid for 24 hours.',
    category: 'Account & Settings', sortOrder: 1, published: true, sourceDocument: 'Product Guide', createdDate: '2026-02-01T10:00:00Z',
  },
  {
    id: 'faq-004', faqNumber: 'FAQ-00004',
    question: 'My Radar dashboard is not loading after deployment.',
    answer: 'Check your deployment status in Salesforce Setup. Verify connected app authorization is current, and try clearing your browser cache.',
    category: 'Troubleshooting', sortOrder: 1, published: true, sourceDocument: 'Troubleshooting Guide', createdDate: '2026-02-01T10:00:00Z',
  },
  {
    id: 'faq-005', faqNumber: 'FAQ-00005',
    question: 'How do Canvas AI credits work?',
    answer: 'Each image generation uses one credit. Credits refresh monthly based on your plan. Check your usage in Canvas Settings.',
    category: 'Products & Features', sortOrder: 1, published: false, sourceDocument: 'Canvas Docs', createdDate: '2026-02-05T10:00:00Z',
  },
];

const AI_CHAT_RESPONSES = [
  "Based on our help articles, I can help with that. Here's what I found:\n\nYou can create a support case by navigating to 'My Cases' and clicking 'New Case'. Include as much detail as possible including screenshots.\n\nWould you like me to help you create a case now?",
  "I understand your concern. Let me check our FAQ for relevant information.\n\nThis seems like a common issue. Try clearing your browser cache and cookies first. If the problem persists, I'd recommend creating a support case so our team can investigate.\n\nIs there anything else I can help with?",
  "Great question! Our product suite includes Radar for source intelligence, Canvas for AI image generation, AgentPM for project management, and LeadGen for lead enrichment.\n\nEach product has dedicated support documentation in our Help section. Would you like me to point you to a specific product's resources?",
];

function mockChat(message: string): SPResponse {
  const lower = message.toLowerCase();
  let responseIdx = 0;
  if (lower.includes('issue') || lower.includes('problem') || lower.includes('error') || lower.includes('bug')) {
    responseIdx = 1;
  } else if (lower.includes('product') || lower.includes('feature') || lower.includes('what')) {
    responseIdx = 2;
  }
  return ok({ reply: AI_CHAT_RESPONSES[responseIdx] });
}

function mockGenerateFAQs(documentText: string, documentName: string): SPResponse {
  const generated: MockFAQ[] = [
    {
      id: uid(), faqNumber: `FAQ-${String(mockFAQs.length + 1).padStart(5, '0')}`,
      question: 'What is the main purpose of this product?',
      answer: 'Based on the document, this product helps streamline your workflow and improve productivity through AI-powered automation.',
      category: 'Getting Started', sortOrder: 1, published: false,
      sourceDocument: documentName || 'Unnamed Document',
      createdDate: new Date().toISOString(),
    },
    {
      id: uid(), faqNumber: `FAQ-${String(mockFAQs.length + 2).padStart(5, '0')}`,
      question: 'How do I get started with the initial setup?',
      answer: 'Follow the onboarding wizard after logging in. It will guide you through connecting your accounts and configuring your preferences.',
      category: 'Getting Started', sortOrder: 2, published: false,
      sourceDocument: documentName || 'Unnamed Document',
      createdDate: new Date().toISOString(),
    },
    {
      id: uid(), faqNumber: `FAQ-${String(mockFAQs.length + 3).padStart(5, '0')}`,
      question: 'What should I do if I encounter an error?',
      answer: 'First, try refreshing the page. If the error persists, check your network connection and clear your browser cache. Create a support case if the issue continues.',
      category: 'Troubleshooting', sortOrder: 1, published: false,
      sourceDocument: documentName || 'Unnamed Document',
      createdDate: new Date().toISOString(),
    },
  ];

  mockFAQs.push(...generated);

  return ok({
    faqs: generated.map(({ id, faqNumber, question, answer, category, sortOrder }) => ({
      id, faqNumber, question, answer, category, sortOrder,
    })),
    count: generated.length,
  });
}

function mockGetFAQs(): SPResponse {
  const published = mockFAQs
    .filter((f) => f.published)
    .map(({ id, faqNumber, question, answer, category, sortOrder }) => ({
      id, faqNumber, question, answer, category, sortOrder,
    }));
  return ok({ faqs: published });
}

function mockGetAdminFAQs(): SPResponse {
  return ok({
    faqs: mockFAQs.map((f) => ({
      id: f.id, faqNumber: f.faqNumber, question: f.question, answer: f.answer,
      category: f.category, sortOrder: f.sortOrder, published: f.published,
      sourceDocument: f.sourceDocument, createdDate: f.createdDate,
    })),
  });
}

function mockUpdateFAQ(faqId: string, question: string, answer: string, category: string, published: boolean): SPResponse {
  const faq = mockFAQs.find((f) => f.id === faqId);
  if (!faq) return err('FAQ not found.');
  if (question) faq.question = question;
  if (answer !== undefined) faq.answer = answer;
  if (category) faq.category = category;
  if (published !== undefined) faq.published = published;
  return ok('FAQ updated.');
}

function mockDeleteFAQ(faqId: string): SPResponse {
  const idx = mockFAQs.findIndex((f) => f.id === faqId);
  if (idx === -1) return err('FAQ not found.');
  mockFAQs.splice(idx, 1);
  return ok('FAQ deleted.');
}
