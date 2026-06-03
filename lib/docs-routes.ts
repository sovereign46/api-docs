export type RouteEntry = {
  method: string;
  path: string;
  href: string;
  description?: string;
};

export const routeIndex = {
  operations: [
    { method: 'GET', path: '/healthz', href: '#liveness', description: 'Process liveness.' },
    { method: 'GET', path: '/readyz', href: '#readiness', description: 'Readiness and database state.' },
    { method: 'GET', path: 'support routes', href: '#browser-support-routes', description: 'Auth and session browser shells.' },
  ],
  auth: [
    { method: 'POST', path: 'device/start', href: '#start-device-login', description: 'Start invite-gated device login.' },
    { method: 'POST', path: 'magic/consume', href: '#approve-the-login', description: 'Approve the pending login.' },
    { method: 'POST', path: 'device/poll', href: '#poll-for-credentials', description: 'Poll for credentials.' },
    { method: 'POST', path: 'token/refresh', href: '#refresh', description: 'Rotate credentials.' },
    { method: 'GET', path: '/device', href: '#authenticated-device-approval', description: 'Check and approve device codes.' },
    { method: 'POST', path: 'passkeys', href: '#passkeys', description: 'Register and log in with WebAuthn.' },
    { method: 'POST', path: 'logout', href: '#logout', description: 'Clear browser auth cookies.' },
  ],
  account: [
    { method: 'GET', path: '/v1/me', href: '#current-user', description: 'Authenticated user and role.' },
    { method: 'GET', path: '/v1/devices', href: '#paired-devices', description: 'List active paired devices.' },
    { method: 'DELETE', path: '/v1/devices/{deviceId}', href: '#paired-devices', description: 'Revoke one paired device.' },
  ],
  teamsSessions: [
    { method: 'GET', path: '/v1/teams/{team}', href: '#resolve-team-metadata', description: 'Resolve gateway config.' },
    { method: 'GET', path: '/v1/sessions', href: '#list-sessions', description: 'List team sessions.' },
    { method: 'POST', path: 'detach / resume', href: '#detach--resume', description: 'Detach or resume a session.' },
    { method: 'POST', path: 'attach', href: '#attach--stream', description: 'Return attach metadata.' },
    { method: 'GET', path: 'stream', href: '#attach--stream', description: 'Stream handoff events.' },
    { method: 'POST', path: 'land', href: '#land', description: 'Queue landing/review work.' },
  ],
  admin: [
    { method: 'GET', path: 'organizations', href: '#capability-groups', description: 'Org settings and membership.' },
    { method: 'GET', path: 'people / invites', href: '#people--invitations', description: 'Directory and invitations.' },
    { method: 'GET', path: 'teams', href: '#capability-groups', description: 'Team CRUD and defaults.' },
    { method: 'GET', path: 'workers / jobs', href: '#capability-groups', description: 'Runtime and queues.' },
    { method: 'GET', path: 'usage / audit', href: '#usage--audit', description: 'Reports and audit log.' },
  ],
  models: [
    { method: 'GET', path: '/v1/admin/models', href: '#certified-models', description: 'List certified models.' },
    { method: 'GET', path: '/v1/admin/model-policies', href: '#team-model-policy', description: 'Read team policy.' },
    { method: 'PUT', path: '/v1/admin/model-policies', href: '#team-model-policy', description: 'Set team policy.' },
  ],
  workerControl: [
    { method: 'POST', path: 'register', href: '#lease-lifecycle', description: 'Register worker and receive credential.' },
    { method: 'POST', path: 'heartbeat', href: '#lease-lifecycle', description: 'Report liveness and state.' },
    { method: 'POST', path: 'lease', href: '#lease-a-job', description: 'Lease compatible queued work.' },
    { method: 'POST', path: 'lease/{jobId}/ack', href: '#lease-lifecycle', description: 'Acknowledge a lease.' },
    { method: 'POST', path: 'jobs/{jobId}/complete', href: '#complete-a-job', description: 'Report job outcome.' },
  ],
  gateway: [
    { method: 'POST', path: '/v1/chat/completions', href: '#chat-completions', description: 'OpenAI Chat Completions.' },
    { method: 'POST', path: '/v1/responses', href: '#responses--codex', description: 'OpenAI Responses.' },
    { method: 'POST', path: '/anthropic/v1/messages', href: '#anthropic-messages', description: 'Anthropic Messages.' },
    { method: 'GET', path: 'models', href: '#model-discovery', description: 'OpenAI, Anthropic, Codex lists.' },
    { method: 'GET', path: 'workers', href: '#airplane-mode-workers', description: 'Airplane-mode local workers.' },
  ],
} satisfies Record<string, RouteEntry[]>;

export type RouteIndexName = keyof typeof routeIndex;
