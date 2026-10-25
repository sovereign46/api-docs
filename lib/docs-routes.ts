export type RouteEntry = {
  method: string;
  path: string;
  href: string;
  description?: string;
};

export const routeIndex = {
  operations: [
    { method: 'GET', path: '/healthz', href: '#liveness', description: 'Process liveness.' },
    { method: 'GET', path: '/readyz', href: '#readiness', description: 'Database and independent registry readiness.' },
    { method: 'GET', path: '/debug/vars', href: '#diagnostics--support', description: 'Operator-authorized diagnostics.' },
    { method: 'GET', path: '/assets/auth.css', href: '#diagnostics--support', description: 'Auth page stylesheet.' }
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
    { method: 'GET', path: '/v1/teams/{team}', href: '#resolve-team-metadata', description: 'Gateway config and authorized runtime metadata.' },
    { method: 'GET', path: '/v1/sessions', href: '#list-sessions', description: 'List team sessions.' },
  ],
  admin: [
    { method: 'GET', path: 'organizations', href: '#capability-groups', description: 'Org settings and membership.' },
    { method: 'GET', path: 'people / invites', href: '#people--invitations', description: 'Directory and invitations.' },
    { method: 'GET', path: '/v1/admin/teams/{team}', href: '#team-settings', description: 'Configured team settings, not model discovery.' },
    { method: 'GET', path: '/v1/admin/harness-policies', href: '#harness-policies', description: 'Stored harness configuration, not enforcement.' },
    { method: 'GET', path: 'workers / jobs', href: '#capability-groups', description: 'Runtime and queues.' },
    { method: 'GET', path: 'usage / audit', href: '#usage--audit', description: 'Reports and audit log.' },
  ],
  models: [
    { method: 'GET', path: '/v1/admin/model-releases', href: '#model-release-lifecycle', description: 'List API-backed model releases.' },
    { method: 'POST', path: '/v1/admin/model-releases', href: '#model-release-lifecycle', description: 'Create a model release.' },
    { method: 'GET', path: '/v1/admin/model-releases/{releaseId}', href: '#model-release-lifecycle', description: 'Read release state.' },
    { method: 'POST', path: '/v1/admin/model-releases/{releaseId}/upload-session', href: '#model-release-lifecycle', description: 'Open quarantine upload.' },
    { method: 'POST', path: '/v1/admin/model-releases/{releaseId}/finalize-upload', href: '#model-release-lifecycle', description: 'Finalize artifact metadata.' },
    { method: 'POST', path: '/v1/admin/model-releases/{releaseId}/validate', href: '#model-release-lifecycle', description: 'Queue certification.' },
    { method: 'POST', path: '/v1/admin/model-releases/{releaseId}/publish', href: '#model-release-lifecycle', description: 'Queue publication.' },
    { method: 'POST', path: '/v1/admin/model-releases/{releaseId}/yank', href: '#model-release-lifecycle', description: 'Block serving and queue signed yank.' },
    { method: 'GET', path: '/v1/admin/models', href: '#certified-models', description: 'Inspect catalog and verification state.' },
    { method: 'GET', path: '/v1/admin/model-policies', href: '#team-model-policy', description: 'Read team policy.' },
    { method: 'PUT', path: '/v1/admin/model-policies', href: '#team-model-policy', description: 'Set team policy.' },
  ],
  workerControl: [
    { method: 'POST', path: '/v1/worker/register', href: '#register', description: 'Operator-only provisioning; returns a worker credential.' },
    { method: 'POST', path: '/v1/worker/heartbeat', href: '#lease-lifecycle', description: 'Report liveness and state.' },
    { method: 'POST', path: '/v1/worker/jobs/lease', href: '#lease-a-job', description: 'Lease compatible queued work.' },
    { method: 'POST', path: '/v1/internal/leases/ack', href: '#lease-lifecycle', description: 'Acknowledge a lease.' },
    { method: 'POST', path: '/v1/worker/jobs/complete', href: '#complete-a-job', description: 'Report job outcome.' },
  ],
  gateway: [
    { method: 'POST', path: '/v1/chat/completions', href: '#chat-completions', description: 'OpenAI Chat Completions.' },
    { method: 'POST', path: '/v1/responses', href: '#responses--codex', description: 'OpenAI Responses.' },
    { method: 'POST', path: '/codex/v1/responses', href: '#responses--codex', description: 'Codex Responses subset.' },
    { method: 'POST', path: '/anthropic/v1/messages', href: '#anthropic-messages', description: 'Anthropic Messages subset.' },
    { method: 'GET', path: '/v1/models', href: '#model-discovery', description: 'OpenAI model list.' },
    { method: 'GET', path: '/anthropic/v1/models', href: '#model-discovery', description: 'Anthropic model list.' },
    { method: 'GET', path: '/codex/v1/models', href: '#model-discovery', description: 'Codex model list.' },
    { method: 'GET', path: '/v1/workers', href: '#airplane-mode-workers', description: 'Airplane-mode local workers.' },
    { method: 'GET', path: '/v1/workers/{id}', href: '#airplane-mode-workers', description: 'One local worker.' },
  ],
} satisfies Record<string, RouteEntry[]>;

export type RouteIndexName = keyof typeof routeIndex;
