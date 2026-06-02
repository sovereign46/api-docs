export const dynamic = 'force-static';

type SecurityRequirement = Array<Record<string, string[]>>;

const bearerSecurity: SecurityRequirement = [{ bearerAuth: [] }];
const gatewayServers = [{ url: 'https://gateway.s46.dev', description: 'Production harness gateway' }];

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function jsonContent(schema: unknown) {
  return {
    content: {
      'application/json': { schema },
    },
  };
}

function requestBody(schema: unknown, required = true) {
  return {
    required,
    ...jsonContent(schema),
  };
}

function response(description: string, schema?: unknown, contentType = 'application/json') {
  if (!schema) return { description };
  return {
    description,
    content: {
      [contentType]: { schema },
    },
  };
}

function htmlResponse(description: string) {
  return response(description, { type: 'string' }, 'text/html');
}

function textResponse(description: string, contentType: string) {
  return response(description, { type: 'string' }, contentType);
}

function collection(name: string, schema: unknown) {
  return {
    type: 'object',
    required: [name],
    properties: {
      [name]: {
        type: 'array',
        items: schema,
      },
    },
  };
}

function pathParam(name: string, description: string, example?: string) {
  return {
    name,
    in: 'path',
    required: true,
    description: `${description}. URL path-escape this value.`,
    schema: { type: 'string' },
    ...(example ? { example } : {}),
  };
}

function queryParam(name: string, description: string, required = false) {
  return {
    name,
    in: 'query',
    required,
    description,
    schema: { type: 'string' },
  };
}

function headerParam(name: string, description: string, required = false) {
  return {
    name,
    in: 'header',
    required,
    description,
    schema: { type: 'string' },
  };
}

const errorResponses = {
  '400': response('Invalid request', ref('ErrorResponse')),
  '401': response('Unauthorized', ref('ErrorResponse')),
  '403': response('Forbidden', ref('ErrorResponse')),
  '404': response('Not found', ref('ErrorResponse')),
  '405': response('Method not allowed', ref('ErrorResponse')),
  '409': response('Conflict', ref('ErrorResponse')),
  '410': response('Expired', ref('ErrorResponse')),
  '412': response('Precondition failed', ref('ErrorResponse')),
  '428': response('Authorization pending or precondition required', ref('ErrorResponse')),
  '429': response('Rate limited', ref('ErrorResponse')),
  '500': response('Internal error', ref('ErrorResponse')),
  '503': response('Service unavailable', ref('ErrorResponse')),
};

type OperationOptions = {
  security?: SecurityRequirement | null;
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
  servers?: unknown[];
};

function operation(tags: string[], summary: string, operationId: string, options: OperationOptions) {
  return {
    tags,
    summary,
    operationId,
    ...(options.security === null ? {} : { security: options.security ?? bearerSecurity }),
    ...(options.parameters ? { parameters: options.parameters } : {}),
    ...(options.requestBody ? { requestBody: options.requestBody } : {}),
    ...(options.servers ? { servers: options.servers } : {}),
    responses: options.responses,
  };
}

function publicGet(tags: string[], summary: string, operationId: string, output: unknown, parameters: unknown[] = [], servers?: unknown[]) {
  return operation(tags, summary, operationId, {
    security: null,
    parameters,
    servers,
    responses: {
      '200': response(summary, output),
      ...errorResponses,
    },
  });
}

function authenticatedGet(tags: string[], summary: string, operationId: string, output: unknown, parameters: unknown[] = []) {
  return operation(tags, summary, operationId, {
    parameters,
    responses: {
      '200': response(summary, output),
      ...errorResponses,
    },
  });
}

function authenticatedWrite(tags: string[], summary: string, operationId: string, input: unknown, output: unknown, success = '200', parameters: unknown[] = []) {
  return operation(tags, summary, operationId, {
    parameters,
    requestBody: requestBody(input),
    responses: {
      [success]: response(summary, output),
      ...errorResponses,
    },
  });
}

function adminGet(summary: string, operationId: string, output: unknown, parameters: unknown[] = []) {
  return authenticatedGet(['Admin'], summary, operationId, output, parameters);
}

function adminWrite(summary: string, operationId: string, input: unknown, output: unknown, success = '200', parameters: unknown[] = []) {
  return authenticatedWrite(['Admin'], summary, operationId, input, output, success, parameters);
}

function modelAdminGet(summary: string, operationId: string, output: unknown, parameters: unknown[] = []) {
  return authenticatedGet(['Models'], summary, operationId, output, parameters);
}

function modelAdminWrite(summary: string, operationId: string, input: unknown, output: unknown, methodSuccess = '200', parameters: unknown[] = []) {
  return authenticatedWrite(['Models'], summary, operationId, input, output, methodSuccess, parameters);
}

function workerWrite(summary: string, operationId: string, input: unknown, output: unknown, success = '200') {
  return authenticatedWrite(['Worker control'], summary, operationId, input, output, success);
}

function gatewayGet(summary: string, operationId: string, output: unknown) {
  return publicGet(['Harness gateway'], summary, operationId, output, [], gatewayServers);
}

function gatewayPost(summary: string, operationId: string, input: unknown, output: unknown) {
  return operation(['Harness gateway'], summary, operationId, {
    security: bearerSecurity,
    servers: gatewayServers,
    requestBody: requestBody(input),
    responses: {
      '200': response(summary, output),
      ...errorResponses,
    },
  });
}

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Sovereign46 API',
    version: '1.0.0',
    description: 'Production contract for Sovereign46 API consumers, admin tooling, workers, and model gateway integrations.',
  },
  servers: [
    { url: 'https://api.s46.dev', description: 'Production control plane' },
    { url: 'http://127.0.0.1:8080', description: 'Local development control plane' },
  ],
  tags: [
    { name: 'Operations' },
    { name: 'Auth' },
    { name: 'Account' },
    { name: 'Teams and sessions' },
    { name: 'Admin' },
    { name: 'Models' },
    { name: 'Worker control' },
    { name: 'Internal' },
    { name: 'Harness gateway' },
    { name: 'Support' },
  ],
  paths: {
    '/healthz': {
      get: publicGet(['Operations'], 'Liveness check', 'healthz', ref('HealthResponse')),
    },
    '/readyz': {
      get: publicGet(['Operations'], 'Readiness check', 'readyz', ref('ReadyResponse')),
    },
    '/debug/vars': {
      get: authenticatedGet(['Operations'], 'Expvar diagnostics', 'debugVars', { type: 'object', additionalProperties: true }),
    },
    '/assets/auth.css': {
      get: operation(['Support'], 'Auth page stylesheet', 'authCss', {
        security: null,
        responses: {
          '200': textResponse('CSS stylesheet', 'text/css'),
          ...errorResponses,
        },
      }),
    },
    '/session': {
      get: operation(['Support'], 'Session handoff shell', 'sessionShell', {
        security: null,
        responses: {
          '200': htmlResponse('HTML session handoff shell'),
          ...errorResponses,
        },
      }),
    },
    '/session/': {
      get: operation(['Support'], 'Session handoff shell', 'sessionShellSlash', {
        security: null,
        responses: {
          '200': htmlResponse('HTML session handoff shell'),
          ...errorResponses,
        },
      }),
    },
    '/v1/auth/device/start': {
      post: operation(['Auth'], 'Start invite-gated device login', 'startDeviceLogin', {
        security: null,
        requestBody: requestBody(ref('DeviceLoginStartRequest')),
        responses: {
          '202': response('Device login challenge created', ref('DeviceLoginStartResponse')),
          ...errorResponses,
        },
      }),
    },
    '/v1/auth/login/start': {
      post: operation(['Auth'], 'Start login alias', 'startLoginAlias', {
        security: null,
        requestBody: requestBody(ref('DeviceLoginStartRequest')),
        responses: {
          '202': response('Device login challenge created', ref('DeviceLoginStartResponse')),
          ...errorResponses,
        },
      }),
    },
    '/v1/auth/device/poll': {
      post: operation(['Auth'], 'Poll device login for approval', 'pollDeviceLogin', {
        security: null,
        requestBody: requestBody(ref('DeviceLoginPollRequest')),
        responses: {
          '200': response('Approved token set', ref('TokenSet')),
          ...errorResponses,
        },
      }),
    },
    '/v1/auth/magic/consume': {
      get: operation(['Auth'], 'Render magic-link confirmation page', 'confirmMagicLink', {
        security: null,
        parameters: [queryParam('token', 'Magic-link token', true)],
        responses: {
          '200': htmlResponse('HTML confirmation page'),
          ...errorResponses,
        },
      }),
      post: operation(['Auth'], 'Approve magic-link login', 'approveMagicLink', {
        security: null,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: ref('MagicLinkConsumeRequest') },
            'application/x-www-form-urlencoded': { schema: ref('MagicLinkConsumeRequest') },
          },
        },
        responses: {
          '200': htmlResponse('HTML approval page'),
          ...errorResponses,
        },
      }),
    },
    '/v1/auth/token/refresh': {
      post: operation(['Auth'], 'Refresh and rotate credentials', 'refreshToken', {
        security: null,
        requestBody: requestBody(ref('RefreshTokenRequest'), false),
        responses: {
          '200': response('Refreshed token set', ref('TokenSet')),
          ...errorResponses,
        },
      }),
    },
    '/v1/auth/passkeys/register/start': {
      post: authenticatedWrite(['Auth'], 'Start passkey registration', 'startPasskeyRegistration', ref('EmptyObject'), ref('WebAuthnOptions')),
    },
    '/v1/auth/passkeys/register/finish': {
      post: authenticatedWrite(['Auth'], 'Finish passkey registration', 'finishPasskeyRegistration', ref('WebAuthnRegistrationResponse'), ref('PasskeyRegistrationResult')),
    },
    '/v1/auth/passkeys/login/start': {
      post: operation(['Auth'], 'Start passkey login', 'startPasskeyLogin', {
        security: null,
        requestBody: requestBody(ref('PasskeyLoginStartRequest')),
        responses: {
          '200': response('WebAuthn authentication options', ref('WebAuthnOptions')),
          ...errorResponses,
        },
      }),
    },
    '/v1/auth/passkeys/login/finish': {
      post: operation(['Auth'], 'Finish passkey login', 'finishPasskeyLogin', {
        security: null,
        requestBody: requestBody(ref('WebAuthnAuthenticationResponse')),
        responses: {
          '200': response('Approved token set', ref('TokenSet')),
          ...errorResponses,
        },
      }),
    },
    '/v1/auth/logout': {
      post: operation(['Auth'], 'Clear browser auth cookies', 'logout', {
        security: null,
        requestBody: requestBody(ref('EmptyObject'), false),
        responses: {
          '200': response('Logged out', ref('OKResponse')),
          ...errorResponses,
        },
      }),
    },
    '/device': {
      get: authenticatedGet(['Auth'], 'Check browser device-approval authentication', 'deviceApprovalStatus', ref('DeviceApprovalStatus')),
      post: authenticatedWrite(['Auth'], 'Approve a device user code', 'approveDeviceCode', ref('DeviceApprovalRequest'), ref('DeviceApprovalResponse')),
    },
    '/v1/me': {
      get: authenticatedGet(['Account'], 'Current authenticated user', 'me', ref('User')),
    },
    '/v1/devices': {
      get: authenticatedGet(['Account'], 'List paired devices', 'listDevices', collection('devices', ref('Device'))),
    },
    '/v1/devices/{deviceId}': {
      delete: operation(['Account'], 'Revoke paired device', 'deleteDevice', {
        parameters: [pathParam('deviceId', 'Device id', 'dev-laptop')],
        responses: {
          '200': response('Device revoked', ref('RevokedDeviceResponse')),
          ...errorResponses,
        },
      }),
    },
    '/v1/teams/{team}': {
      get: authenticatedGet(['Teams and sessions'], 'Resolve team metadata', 'team', ref('Team'), [
        pathParam('team', 'Canonical team id', '%40s46%2Fengineering'),
        queryParam('endpoint', 'Development endpoint override'),
        queryParam('region', 'Development region override'),
        queryParam('mode', 'Development mode override'),
        queryParam('defaultModel', 'Development default model override'),
      ]),
    },
    '/v1/sessions': {
      get: authenticatedGet(['Teams and sessions'], 'List sessions for a team', 'listSessions', collection('sessions', ref('Session')), [queryParam('team', 'Canonical team id', true)]),
    },
    '/v1/sessions/{sessionId}/detach': sessionAction('detach', ref('DetachRequest'), ref('Session')),
    '/v1/sessions/{sessionId}/resume': sessionAction('resume', ref('ResumeRequest'), ref('Session')),
    '/v1/sessions/{sessionId}/attach': sessionAction('attach', ref('AttachRequest'), ref('AttachResult')),
    '/v1/sessions/{sessionId}/stream': {
      get: operation(['Teams and sessions'], 'Stream session handoff events', 'streamSession', {
        parameters: [pathParam('sessionId', 'Session id', '%40dscape%2Fauth-redirect-fix'), queryParam('team', 'Canonical team id', true)],
        responses: {
          '200': textResponse('SSE session stream', 'text/event-stream'),
          ...errorResponses,
        },
      }),
    },
    '/v1/sessions/{sessionId}/land': sessionAction('land', ref('LandRequest'), ref('LandResult')),
    '/v1/admin/overview': {
      get: adminGet('Admin overview', 'adminOverview', ref('Overview'), [queryParam('organization', 'Organization slug'), queryParam('team', 'Canonical team id')]),
    },
    '/v1/admin/organizations': {
      get: adminGet('List organizations', 'listOrganizations', collection('organizations', ref('Organization'))),
      post: adminWrite('Create organization', 'createOrganization', ref('Organization'), ref('Organization'), '201'),
    },
    '/v1/admin/organizations/{slug}': {
      get: adminGet('Get organization', 'getOrganization', ref('Organization'), [pathParam('slug', 'Organization slug', 's46')]),
      put: adminWrite('Update organization', 'putOrganization', ref('Organization'), ref('Organization'), '200', [pathParam('slug', 'Organization slug', 's46')]),
      patch: adminWrite('Patch organization', 'patchOrganization', ref('Organization'), ref('Organization'), '200', [pathParam('slug', 'Organization slug', 's46')]),
    },
    '/v1/admin/organization-members': {
      get: adminGet('List organization members', 'listOrganizationMembers', collection('organizationMembers', ref('OrganizationMember')), [queryParam('organization', 'Organization slug', true)]),
      post: adminWrite('Create organization member', 'createOrganizationMember', ref('OrganizationMember'), ref('OrganizationMember')),
      put: adminWrite('Update organization member', 'putOrganizationMember', ref('OrganizationMember'), ref('OrganizationMember')),
      delete: operation(['Admin'], 'Remove organization member', 'deleteOrganizationMember', {
        parameters: [queryParam('organization', 'Organization slug', true), queryParam('email', 'Member email', true)],
        responses: {
          '200': response('Removed', ref('RemovedResponse')),
          ...errorResponses,
        },
      }),
    },
    '/v1/admin/organization-roles': {
      get: adminGet('List organization roles', 'listOrganizationRoles', ref('RolesResponse')),
    },
    '/v1/admin/people': {
      get: adminGet('List people', 'listPeople', collection('people', ref('Person')), [queryParam('organization', 'Organization slug', true), queryParam('team', 'Canonical team id')]),
    },
    '/v1/admin/invite': {
      post: adminWrite('Invite person', 'invitePersonLegacy', ref('InviteRequest'), ref('InviteResponse')),
    },
    '/v1/admin/people/invite': {
      post: adminWrite('Invite person', 'invitePerson', ref('InviteRequest'), ref('InviteResponse')),
    },
    '/v1/admin/invites': {
      get: adminGet('List invitations', 'listInvites', collection('invitations', ref('Invitation')), [queryParam('organization', 'Organization slug'), queryParam('team', 'Canonical team id'), queryParam('status', 'Invitation status'), queryParam('limit', 'Maximum invitations')]),
    },
    '/v1/admin/invite/revoke': {
      post: adminWrite('Revoke invitation', 'revokeInvite', ref('RevokeInviteRequest'), ref('RevokeInviteResponse')),
    },
    '/v1/admin/people/{email}': {
      get: adminGet('Get person', 'getPerson', ref('Person'), [pathParam('email', 'Email address', 'dscape%40s46.dev'), queryParam('organization', 'Organization slug', true)]),
      put: adminWrite('Update person status', 'putPerson', ref('PersonStatusRequest'), ref('Person'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev'), queryParam('organization', 'Organization slug', true)]),
      patch: adminWrite('Patch person status', 'patchPerson', ref('PersonStatusRequest'), ref('Person'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev'), queryParam('organization', 'Organization slug', true)]),
    },
    '/v1/admin/people/{email}/teams': {
      post: adminWrite('Add person to team', 'addPersonTeam', ref('TeamMembership'), ref('TeamMembership'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev')]),
      put: adminWrite('Update person team membership', 'putPersonTeam', ref('TeamMembership'), ref('TeamMembership'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev')]),
    },
    '/v1/admin/people/{email}/teams/{team}': {
      delete: operation(['Admin'], 'Remove person from team', 'deletePersonTeam', {
        parameters: [pathParam('email', 'Email address', 'dscape%40s46.dev'), pathParam('team', 'Canonical team id', '%40s46%2Fengineering')],
        responses: {
          '200': response('Removed', ref('RemovedResponse')),
          ...errorResponses,
        },
      }),
    },
    '/v1/admin/people/{email}/devices/{deviceId}/revoke': {
      post: adminWrite('Revoke person device', 'revokePersonDevice', ref('EmptyObject'), ref('RevokedDeviceResponse'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev'), pathParam('deviceId', 'Device id', 'dev-laptop'), queryParam('organization', 'Organization slug', true)]),
    },
    '/v1/admin/people/{email}/invites/resend': {
      post: adminWrite('Resend invitation', 'resendInvite', ref('EmptyObject'), ref('InvitationResponse'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev'), queryParam('organization', 'Organization slug', true)]),
    },
    '/v1/admin/people/{email}/audit': {
      get: adminGet('Person audit events', 'personAudit', collection('auditEvents', ref('AuditEvent')), [pathParam('email', 'Email address', 'dscape%40s46.dev'), queryParam('organization', 'Organization slug', true), queryParam('team', 'Canonical team id'), queryParam('limit', 'Maximum events')]),
    },
    '/v1/admin/teams': {
      get: adminGet('List teams', 'listAdminTeams', collection('teams', ref('Team')), [queryParam('team', 'Canonical team id')]),
      post: adminWrite('Create team', 'createTeam', ref('Team'), ref('Team')),
    },
    '/v1/admin/teams/{team}': {
      get: adminGet('Get team', 'getAdminTeam', ref('Team'), [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
      put: adminWrite('Update team', 'putTeam', ref('Team'), ref('Team'), '200', [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
      patch: adminWrite('Patch team', 'patchTeam', ref('Team'), ref('Team'), '200', [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
      delete: operation(['Admin'], 'Delete team', 'deleteTeam', {
        parameters: [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')],
        responses: {
          '200': response('Deleted', ref('DeletedTeamResponse')),
          ...errorResponses,
        },
      }),
    },
    '/v1/admin/harness-policies': {
      get: adminGet('Get harness policy by query', 'getHarnessPolicyByQuery', ref('HarnessPolicy'), [queryParam('team', 'Canonical team id')]),
      post: adminWrite('Save harness policy by query', 'saveHarnessPolicyByQuery', ref('HarnessPolicy'), ref('HarnessPolicy')),
      put: adminWrite('Update harness policy by query', 'putHarnessPolicyByQuery', ref('HarnessPolicy'), ref('HarnessPolicy')),
    },
    '/v1/admin/harness-policies/{team}': {
      get: adminGet('Get harness policy', 'getHarnessPolicy', ref('HarnessPolicy'), [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
      post: adminWrite('Save harness policy', 'saveHarnessPolicy', ref('HarnessPolicy'), ref('HarnessPolicy'), '200', [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
      put: adminWrite('Update harness policy', 'putHarnessPolicy', ref('HarnessPolicy'), ref('HarnessPolicy'), '200', [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
    },
    '/v1/admin/github/installations': {
      get: adminGet('List GitHub installations', 'listGitHubInstallations', collection('installations', ref('GitHubInstallation'))),
      post: adminWrite('Save GitHub installation', 'saveGitHubInstallation', ref('GitHubInstallation'), ref('GitHubInstallation')),
    },
    '/v1/admin/repositories': {
      get: adminGet('List repositories', 'listRepositories', collection('repositories', ref('TeamRepository')), [queryParam('team', 'Canonical team id')]),
      post: adminWrite('Save repository', 'saveRepository', ref('TeamRepository'), ref('TeamRepository')),
    },
    '/v1/admin/models': {
      get: modelAdminGet('List verified model catalog', 'listModels', ref('ModelCatalogResponse'), [queryParam('organization', 'Organization slug'), queryParam('team', 'Canonical team id')]),
    },
    '/v1/admin/model-policies': {
      get: modelAdminGet('List team model policies', 'listModelPolicies', collection('modelPolicies', ref('TeamModelPolicy')), [queryParam('team', 'Canonical team id', true)]),
      put: modelAdminWrite('Set team model policy', 'putModelPolicy', ref('TeamModelPolicyRequest'), ref('TeamModelPolicy'), '200', [headerParam('Idempotency-Key', 'Idempotency key for safe retry', true), headerParam('If-Match', 'Known policy ETag/revision')]),
      patch: modelAdminWrite('Patch team model policy', 'patchModelPolicy', ref('TeamModelPolicyRequest'), ref('TeamModelPolicy'), '200', [headerParam('Idempotency-Key', 'Idempotency key for safe retry', true), headerParam('If-Match', 'Known policy ETag/revision')]),
    },
    '/v1/admin/workers': {
      get: adminGet('List workers', 'listWorkers', collection('workers', ref('Worker')), [queryParam('team', 'Canonical team id'), queryParam('kind', 'Worker kind'), queryParam('region', 'Region'), queryParam('state', 'Worker state')]),
    },
    '/v1/admin/workers/{id}': {
      get: adminGet('Get worker with recent logs', 'getWorker', ref('WorkerWithLogs'), [pathParam('id', 'Worker id', 'worker_01')]),
    },
    '/v1/admin/workers/{id}/logs': {
      get: adminGet('Read worker logs', 'workerLogs', collection('logs', ref('WorkerLog')), [pathParam('id', 'Worker id', 'worker_01'), queryParam('limit', 'Maximum log rows')]),
    },
    '/v1/admin/workers/{id}/drain': {
      post: adminWrite('Drain worker', 'drainWorker', ref('EmptyObject'), ref('Worker'), '200', [pathParam('id', 'Worker id', 'worker_01')]),
    },
    '/v1/admin/workers/{id}/revoke': {
      post: adminWrite('Revoke worker', 'revokeWorker', ref('EmptyObject'), ref('Worker'), '200', [pathParam('id', 'Worker id', 'worker_01')]),
    },
    '/v1/admin/jobs': {
      get: adminGet('List jobs', 'listJobs', collection('jobs', ref('Job')), [queryParam('team', 'Canonical team id'), queryParam('state', 'Job state'), queryParam('sessionId', 'Session id'), queryParam('kind', 'Job kind')]),
      post: adminWrite('Enqueue job', 'enqueueJob', ref('JobSpec'), ref('Job'), '202'),
    },
    '/v1/admin/jobs/{id}/logs': {
      get: adminGet('Read job logs', 'jobLogs', collection('logs', ref('JobLog')), [pathParam('id', 'Job id', 'job_01'), queryParam('limit', 'Maximum log rows')]),
    },
    '/v1/admin/jobs/{id}/cancel': {
      post: adminWrite('Cancel job', 'cancelJob', ref('EmptyObject'), ref('Job'), '200', [pathParam('id', 'Job id', 'job_01')]),
    },
    '/v1/admin/jobs/{id}/retry': {
      post: adminWrite('Retry job', 'retryJob', ref('RetryJobRequest'), ref('Job'), '200', [pathParam('id', 'Job id', 'job_01')]),
    },
    '/v1/admin/schedules': {
      get: adminGet('List scheduled jobs', 'listSchedules', collection('schedules', ref('Job')), [queryParam('team', 'Canonical team id')]),
      post: adminWrite('Schedule job', 'scheduleJob', ref('JobSpec'), ref('Job'), '202'),
    },
    '/v1/admin/usage': {
      get: adminGet('List usage events', 'listUsage', collection('usage', ref('UsageEvent')), [queryParam('team', 'Canonical team id'), queryParam('limit', 'Maximum events')]),
    },
    '/v1/admin/audit': {
      get: adminGet('List audit events', 'listAudit', collection('auditEvents', ref('AuditEvent')), [queryParam('team', 'Canonical team id'), queryParam('limit', 'Maximum events')]),
    },
    '/v1/admin/leases/reconcile': {
      post: adminWrite('Reconcile expired leases', 'reconcileLeases', ref('EmptyObject'), ref('ReconcileLeasesResponse')),
    },
    '/v1/admin/seed': {
      post: adminWrite('Seed defaults', 'adminSeed', ref('EmptyObject'), ref('SeedResponse')),
    },
    '/v1/worker/register': {
      post: authenticatedWrite(['Worker control'], 'Register worker', 'registerWorker', ref('WorkerRegistration'), ref('WorkerRegistrationResult'), '201'),
    },
    '/v1/worker/heartbeat': {
      post: workerWrite('Heartbeat worker', 'heartbeatWorker', ref('WorkerHeartbeatEnvelope'), ref('Worker')),
    },
    '/v1/worker/jobs/lease': {
      post: workerWrite('Lease a job', 'leaseJob', ref('LeaseRequest'), ref('LeaseResult')),
    },
    '/v1/worker/jobs/complete': {
      post: workerWrite('Complete a job lease', 'completeJob', ref('CompleteJobRequest'), ref('Job')),
    },
    '/v1/internal/leases/ack': {
      post: authenticatedWrite(['Internal'], 'Acknowledge a lease internally', 'ackLease', ref('LeaseAckRequest'), ref('AcknowledgedResponse'), '202'),
    },
    '/v1/workers': {
      get: gatewayGet('List local gateway workers', 'gatewayWorkers', collection('workers', ref('GatewayWorker'))),
    },
    '/v1/workers/{id}': {
      get: publicGet(['Harness gateway'], 'Get local gateway worker', 'gatewayWorker', ref('GatewayWorker'), [pathParam('id', 'Gateway worker id', 'local-llamacpp')], gatewayServers),
    },
    '/v1/models': {
      get: gatewayGet('OpenAI-compatible model list', 'openAIModels', ref('OpenAIModelList')),
    },
    '/v1/responses': {
      post: gatewayPost('OpenAI Responses-compatible request', 'openAIResponses', ref('OpenAIResponsesRequest'), ref('OpenAIResponse')),
    },
    '/v1/chat/completions': {
      post: gatewayPost('OpenAI Chat Completions-compatible request', 'openAIChatCompletions', ref('OpenAIChatCompletionRequest'), ref('OpenAIChatCompletion')),
    },
    '/anthropic/v1/models': {
      get: gatewayGet('Anthropic-compatible model list', 'anthropicModels', ref('AnthropicModelList')),
    },
    '/anthropic/v1/messages': {
      post: gatewayPost('Anthropic Messages-compatible request', 'anthropicMessages', ref('AnthropicMessageRequest'), ref('AnthropicMessage')),
    },
    '/codex/v1/models': {
      get: gatewayGet('Codex/OpenAI-compatible model list', 'codexModels', ref('OpenAIModelList')),
    },
    '/codex/v1/responses': {
      post: gatewayPost('Codex Responses-compatible request', 'codexResponses', ref('OpenAIResponsesRequest'), ref('OpenAIResponse')),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
    schemas: buildSchemas(),
  },
};

function sessionAction(action: string, input: unknown, output: unknown) {
  return {
    post: authenticatedWrite(['Teams and sessions'], `${action[0]?.toUpperCase() ?? ''}${action.slice(1)} session`, `${action}Session`, input, output, '200', [
      pathParam('sessionId', 'Session id', '%40dscape%2Fauth-redirect-fix'),
      queryParam('team', 'Canonical team id', true),
    ]),
  };
}

function buildSchemas() {
  const timestamp = { type: 'string', format: 'date-time' };
  const stringMap = { type: 'object', additionalProperties: true };
  const capacity = {
    type: 'object',
    properties: {
      slots: { type: 'integer' },
      maxConcurrent: { type: 'integer' },
      inUse: { type: 'integer' },
    },
  };
  const workerModel = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      backendModel: { type: 'string' },
      digest: { type: 'string' },
      state: { type: 'string' },
      ready: { type: 'boolean' },
      updatedAt: timestamp,
    },
  };

  return {
    EmptyObject: { type: 'object', additionalProperties: false },
    ErrorResponse: {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            requestId: { type: 'string' },
          },
        },
      },
    },
    HealthResponse: { type: 'object', properties: { status: { type: 'string' } } },
    ReadyResponse: { type: 'object', properties: { status: { type: 'string' }, database: { type: 'string' } } },
    OKResponse: { type: 'object', properties: { ok: { type: 'boolean' } } },
    RemovedResponse: { type: 'object', properties: { removed: { type: 'boolean' } } },
    DeletedTeamResponse: { type: 'object', properties: { deleted: { type: 'boolean' }, team: { type: 'string' } } },
    RevokedDeviceResponse: { type: 'object', properties: { revoked: { type: 'boolean' }, deviceId: { type: 'string' } } },
    RolesResponse: { type: 'object', properties: { roles: { type: 'array', items: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'] } } } },
    ReconcileLeasesResponse: { type: 'object', properties: { updated: { type: 'integer' } } },
    SeedResponse: { type: 'object', properties: { ok: { type: 'boolean' }, seeded: { type: 'string' } } },
    AcknowledgedResponse: { type: 'object', properties: { acknowledged: { type: 'boolean' } } },
    DeviceLoginStartRequest: {
      type: 'object',
      required: ['email', 'deviceId'],
      properties: {
        email: { type: 'string', format: 'email' },
        deviceId: { type: 'string' },
        deviceName: { type: 'string' },
      },
    },
    DeviceLoginStartResponse: {
      type: 'object',
      required: ['deviceCode', 'userCode', 'verificationUri', 'intervalSeconds', 'expiresAt'],
      properties: {
        deviceCode: { type: 'string' },
        userCode: { type: 'string' },
        verificationUri: { type: 'string', format: 'uri' },
        intervalSeconds: { type: 'integer' },
        expiresAt: timestamp,
      },
    },
    DeviceLoginPollRequest: { type: 'object', required: ['deviceCode'], properties: { deviceCode: { type: 'string' } } },
    MagicLinkConsumeRequest: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
    RefreshTokenRequest: { type: 'object', properties: { refreshToken: { type: 'string' }, account: { type: 'string', format: 'email' } } },
    PasskeyLoginStartRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
    WebAuthnOptions: { type: 'object', additionalProperties: true },
    WebAuthnRegistrationResponse: { type: 'object', additionalProperties: true },
    WebAuthnAuthenticationResponse: { type: 'object', additionalProperties: true },
    PasskeyRegistrationResult: { type: 'object', properties: { ok: { type: 'boolean' }, credential: { type: 'object', additionalProperties: true } } },
    TokenSet: {
      type: 'object',
      required: ['account', 'deviceId', 'accessToken', 'refreshToken', 'expiresAt'],
      properties: {
        account: { type: 'string', format: 'email' },
        organization: { type: 'string' },
        team: { type: 'string' },
        deviceId: { type: 'string' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresAt: timestamp,
      },
    },
    User: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        team: { type: 'string' },
        organization: { type: 'string' },
        role: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'] },
      },
    },
    DeviceApprovalStatus: { type: 'object', properties: { authenticated: { type: 'boolean' }, user: ref('User') } },
    DeviceApprovalRequest: { type: 'object', required: ['userCode'], properties: { userCode: { type: 'string' } } },
    DeviceApprovalResponse: { type: 'object', properties: { approved: { type: 'boolean' }, user: ref('User') } },
    Device: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        account: { type: 'string' },
        organizationSlug: { type: 'string' },
        team: { type: 'string' },
        createdAt: timestamp,
        lastSeenAt: timestamp,
        lastSeenIp: { type: 'string' },
        revokedAt: timestamp,
      },
    },
    Organization: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        legalName: { type: 'string' },
        status: { type: 'string' },
        plan: { type: 'string' },
        primaryRegion: { type: 'string' },
        regions: { type: 'array', items: { type: 'string' } },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    OrganizationMember: {
      type: 'object',
      properties: {
        organizationSlug: { type: 'string' },
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'] },
        displayName: { type: 'string' },
        status: { type: 'string' },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    TeamMembership: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        team: { type: 'string' },
        organizationSlug: { type: 'string' },
        slug: { type: 'string' },
        displayName: { type: 'string' },
        role: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'] },
        region: { type: 'string' },
        createdAt: timestamp,
      },
    },
    Person: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        displayName: { type: 'string' },
        status: { type: 'string' },
        organizationRoles: { type: 'array', items: ref('OrganizationMember') },
        teams: { type: 'array', items: ref('TeamMembership') },
        devices: { type: 'array', items: ref('Device') },
        invitations: { type: 'array', items: ref('Invitation') },
        auditEvents: { type: 'array', items: ref('AuditEvent') },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    PersonStatusRequest: { type: 'object', properties: { status: { type: 'string' } } },
    Invitation: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        organizationSlug: { type: 'string' },
        team: { type: 'string' },
        teams: { type: 'array', items: { type: 'string' } },
        role: { type: 'string' },
        status: { type: 'string' },
        usedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    InviteRequest: {
      type: 'object',
      required: ['email', 'role'],
      properties: {
        email: { type: 'string', format: 'email' },
        organizationSlug: { type: 'string' },
        team: { type: 'string' },
        teams: { type: 'array', items: { type: 'string' } },
        role: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'] },
      },
    },
    InviteResponse: { type: 'object', properties: { user: ref('UserRecord'), emailSent: { type: 'boolean' } } },
    InvitationResponse: { type: 'object', properties: { invitation: ref('Invitation'), emailSent: { type: 'boolean' } } },
    RevokeInviteRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' }, organizationSlug: { type: 'string' }, team: { type: 'string' } } },
    RevokeInviteResponse: { type: 'object', properties: { revoked: { type: 'boolean' }, invitation: ref('Invitation') } },
    UserRecord: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        team: { type: 'string' },
        organizationSlug: { type: 'string' },
        role: { type: 'string' },
        status: { type: 'string' },
        displayName: { type: 'string' },
      },
    },
    Team: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        organizationSlug: { type: 'string' },
        slug: { type: 'string' },
        displayName: { type: 'string' },
        endpoint: { type: 'string', format: 'uri' },
        region: { type: 'string' },
        mode: { type: 'string' },
        workerHosts: { type: 'array', items: { type: 'string' } },
        defaultModel: { type: 'string' },
        models: { type: 'array', items: { type: 'string' } },
        monthlyCapMicros: { type: 'integer' },
        memberCount: { type: 'integer' },
        deviceCount: { type: 'integer' },
        workerCount: { type: 'integer' },
        spendMicros: { type: 'integer' },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    Session: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        state: { type: 'string' },
        harness: { type: 'string' },
        location: { type: 'string' },
        region: { type: 'string' },
        model: { type: 'string' },
        age: { type: 'string' },
        spent: { type: 'string' },
        task: { type: 'string' },
      },
    },
    DetachRequest: { type: 'object', properties: { sessionId: { type: 'string' }, harness: { type: 'string' }, workerHost: { type: 'string' }, team: ref('Team') } },
    ResumeRequest: { type: 'object', properties: { sessionId: { type: 'string' }, session: ref('Session'), team: ref('Team'), target: { type: 'string', enum: ['remote', 'local'] } } },
    AttachRequest: { type: 'object', properties: { sessionId: { type: 'string' }, team: ref('Team') } },
    LandRequest: { type: 'object', properties: { sessionId: { type: 'string' }, session: ref('Session'), team: ref('Team'), title: { type: 'string' } } },
    AttachResult: { type: 'object', properties: { sessionId: { type: 'string' }, url: { type: 'string', format: 'uri' }, protocol: { type: 'string' } } },
    LandResult: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        branch: { type: 'string' },
        ranOn: { type: 'array', items: { type: 'string' } },
        harness: { type: 'string' },
        model: { type: 'string' },
        cost: { type: 'string' },
        status: { type: 'string' },
        pullRequestUrl: { type: 'string', format: 'uri' },
        blockedReason: { type: 'string' },
        review: { type: 'object', properties: { summary: { type: 'string' }, checklist: { type: 'array', items: { type: 'string' } }, suggestedCommands: { type: 'array', items: { type: 'string' } } } },
      },
    },
    ModelCatalogEntry: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        displayName: { type: 'string' },
        provider: { type: 'string' },
        region: { type: 'string' },
        capabilities: { type: 'array', items: { type: 'string' } },
        contextWindow: { type: 'integer' },
        maxOutputTokens: { type: 'integer' },
        inputCostMicrosPerToken: { type: 'integer' },
        outputCostMicrosPerToken: { type: 'integer' },
        status: { type: 'string' },
        backendModel: { type: 'string' },
        digest: { type: 'string' },
        version: { type: 'string' },
        filename: { type: 'string' },
        artifactUrl: { type: 'string' },
        manifestUrl: { type: 'string' },
        manifestSignatureUrl: { type: 'string' },
        size: { type: 'integer' },
        sha256: { type: 'string' },
        bundleDigest: { type: 'string' },
        artifactDigest: { type: 'string' },
        releaseSignatureSubjectDigest: { type: 'string' },
        certified: { type: 'boolean' },
        published: { type: 'boolean' },
        yanked: { type: 'boolean' },
        advisoryBlocked: { type: 'boolean' },
        globallyBlocked: { type: 'boolean' },
        sigsumStatus: { type: 'string' },
        verificationState: { type: 'string' },
        verificationError: { type: 'string' },
        advisoryUrls: { type: 'array', items: { type: 'string' } },
        yankUrls: { type: 'array', items: { type: 'string' } },
        registryCreatedAt: timestamp,
        syncedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    ModelCatalogResponse: {
      type: 'object',
      properties: {
        models: { type: 'array', items: ref('ModelCatalogEntry') },
        modelPolicies: { type: 'array', items: ref('TeamModelPolicy') },
      },
    },
    TeamModelPolicy: {
      type: 'object',
      properties: {
        team: { type: 'string' },
        organizationSlug: { type: 'string' },
        modelId: { type: 'string' },
        allowed: { type: 'boolean' },
        isDefault: { type: 'boolean' },
        revision: { type: 'integer' },
        etag: { type: 'string' },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    TeamModelPolicyRequest: {
      type: 'object',
      required: ['team', 'modelId'],
      properties: {
        team: { type: 'string' },
        modelId: { type: 'string' },
        allowed: { type: 'boolean' },
        isDefault: { type: 'boolean' },
      },
    },
    Overview: {
      type: 'object',
      properties: {
        organizations: { type: 'integer' },
        teams: { type: 'integer' },
        people: { type: 'integer' },
        workers: { type: 'integer' },
        jobs: { type: 'object', additionalProperties: { type: 'integer' } },
        models: { type: 'integer' },
        regions: { type: 'array', items: { type: 'string' } },
        usage: { type: 'object', properties: { costMicros: { type: 'integer' }, inputTokens: { type: 'integer' }, outputTokens: { type: 'integer' } } },
      },
    },
    Capacity: capacity,
    WorkerModel: workerModel,
    WorkerRegistration: {
      type: 'object',
      required: ['kind', 'region', 'version', 'capabilities', 'capacity'],
      properties: {
        id: { type: 'string' },
        organizationSlug: { type: 'string' },
        team: { type: 'string' },
        kind: { type: 'string', enum: ['model_worker', 'execution_worker', 'hybrid_worker'] },
        region: { type: 'string' },
        version: { type: 'string' },
        endpoint: { type: 'string' },
        protocol: { type: 'string' },
        capabilities: { type: 'array', items: { type: 'string' } },
        capacity,
        models: { type: 'array', items: { type: 'string' } },
        modelDetails: { type: 'array', items: workerModel },
      },
    },
    Worker: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        organizationSlug: { type: 'string' },
        team: { type: 'string' },
        kind: { type: 'string' },
        region: { type: 'string' },
        version: { type: 'string' },
        endpoint: { type: 'string' },
        protocol: { type: 'string' },
        state: { type: 'string' },
        capabilities: { type: 'array', items: { type: 'string' } },
        capacity,
        models: { type: 'array', items: { type: 'string' } },
        modelDetails: { type: 'array', items: workerModel },
        drainRequested: { type: 'boolean' },
        revokedAt: timestamp,
        lastHeartbeatAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    WorkerWithLogs: { type: 'object', properties: { worker: ref('Worker'), logs: { type: 'array', items: ref('WorkerLog') } } },
    WorkerRegistrationResult: { type: 'object', properties: { worker: ref('Worker'), token: { type: 'string' } } },
    WorkerHeartbeat: { type: 'object', properties: { state: { type: 'string' }, capacity, models: { type: 'array', items: { type: 'string' } }, modelDetails: { type: 'array', items: workerModel } } },
    WorkerHeartbeatEnvelope: { type: 'object', required: ['workerId', 'heartbeat'], properties: { workerId: { type: 'string' }, heartbeat: ref('WorkerHeartbeat') } },
    Job: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        organizationSlug: { type: 'string' },
        team: { type: 'string' },
        sessionId: { type: 'string' },
        kind: { type: 'string', enum: ['model', 'execution'] },
        state: { type: 'string', enum: ['queued', 'leased', 'succeeded', 'failed', 'canceled', 'timed_out'] },
        priority: { type: 'integer' },
        region: { type: 'string' },
        harness: { type: 'string' },
        model: { type: 'string' },
        workerId: { type: 'string' },
        leaseId: { type: 'string' },
        leaseExpiresAt: timestamp,
        runAfter: timestamp,
        runBefore: timestamp,
        maxRuntimeSeconds: { type: 'integer' },
        maxCostMicros: { type: 'integer' },
        actor: { type: 'string' },
        repository: { type: 'string' },
        branch: { type: 'string' },
        costMicros: { type: 'integer' },
        sandboxException: { type: 'string' },
        payload: stringMap,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    JobSpec: {
      type: 'object',
      required: ['team', 'sessionId', 'kind'],
      properties: {
        team: { type: 'string' },
        sessionId: { type: 'string' },
        kind: { type: 'string', enum: ['model', 'execution'] },
        priority: { type: 'integer' },
        region: { type: 'string' },
        harness: { type: 'string' },
        model: { type: 'string' },
        runAfter: timestamp,
        runBefore: timestamp,
        maxRuntimeSeconds: { type: 'integer' },
        maxCostMicros: { type: 'integer' },
        actor: { type: 'string' },
        repository: { type: 'string' },
        branch: { type: 'string' },
        payload: stringMap,
      },
    },
    JobLease: { type: 'object', properties: { id: { type: 'string' }, jobId: { type: 'string' }, workerId: { type: 'string' }, state: { type: 'string' }, expiresAt: timestamp, createdAt: timestamp, updatedAt: timestamp } },
    LeaseRequest: { type: 'object', required: ['workerId'], properties: { workerId: { type: 'string' }, leaseSeconds: { type: 'integer' } } },
    LeaseResult: { type: 'object', properties: { job: ref('Job'), lease: ref('JobLease') } },
    LeaseAckRequest: { type: 'object', required: ['workerId', 'jobId', 'leaseId'], properties: { workerId: { type: 'string' }, jobId: { type: 'string' }, leaseId: { type: 'string' } } },
    JobCompletion: { type: 'object', properties: { state: { type: 'string', enum: ['succeeded', 'failed', 'canceled'] }, payload: stringMap, usage: ref('UsageEvent') } },
    CompleteJobRequest: { type: 'object', required: ['workerId', 'jobId', 'leaseId', 'completion'], properties: { workerId: { type: 'string' }, jobId: { type: 'string' }, leaseId: { type: 'string' }, completion: ref('JobCompletion') } },
    RetryJobRequest: { type: 'object', properties: { runAfter: timestamp } },
    UsageEvent: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        organizationSlug: { type: 'string' },
        team: { type: 'string' },
        actor: { type: 'string' },
        sessionId: { type: 'string' },
        jobId: { type: 'string' },
        model: { type: 'string' },
        inputTokens: { type: 'integer' },
        outputTokens: { type: 'integer' },
        costMicros: { type: 'integer' },
        eventType: { type: 'string' },
        metadata: stringMap,
        at: timestamp,
      },
    },
    HarnessPolicy: {
      type: 'object',
      properties: {
        team: { type: 'string' },
        allowedFunctions: { type: 'array', items: { type: 'string' } },
        mandatoryFunctions: { type: 'array', items: { type: 'string' } },
        landGates: { type: 'array', items: { type: 'string' } },
        sandboxProfiles: { type: 'array', items: { type: 'string' } },
        loopEnabled: { type: 'boolean' },
        exceptionLogging: { type: 'boolean' },
        config: stringMap,
        updatedAt: timestamp,
      },
    },
    GitHubInstallation: {
      type: 'object',
      properties: {
        organizationSlug: { type: 'string' },
        installationId: { type: 'integer' },
        accountLogin: { type: 'string' },
        accountType: { type: 'string' },
        permissions: { type: 'object', additionalProperties: { type: 'string' } },
        events: { type: 'array', items: { type: 'string' } },
        status: { type: 'string' },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    TeamRepository: {
      type: 'object',
      properties: {
        team: { type: 'string' },
        provider: { type: 'string' },
        installationId: { type: 'integer' },
        owner: { type: 'string' },
        repo: { type: 'string' },
        defaultBranch: { type: 'string' },
        policy: stringMap,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    WorkerLog: { type: 'object', properties: { id: { type: 'integer' }, workerId: { type: 'string' }, level: { type: 'string' }, message: { type: 'string' }, metadata: stringMap, createdAt: timestamp } },
    JobLog: { type: 'object', properties: { id: { type: 'integer' }, jobId: { type: 'string' }, workerId: { type: 'string' }, level: { type: 'string' }, message: { type: 'string' }, metadata: stringMap, createdAt: timestamp } },
    AuditEvent: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        actor: { type: 'string' },
        email: { type: 'string' },
        organizationSlug: { type: 'string' },
        team: { type: 'string' },
        action: { type: 'string' },
        outcome: { type: 'string' },
        deviceId: { type: 'string' },
        subject: { type: 'string' },
        ipAddress: { type: 'string' },
        metadata: stringMap,
        at: timestamp,
      },
    },
    GatewayWorkerModel: { type: 'object', properties: { id: { type: 'string' }, backendModel: { type: 'string' }, state: { type: 'string' } } },
    GatewayWorker: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        mode: { type: 'string' },
        kind: { type: 'string' },
        protocol: { type: 'string' },
        state: { type: 'string' },
        models: { type: 'array', items: ref('GatewayWorkerModel') },
        capabilities: { type: 'array', items: { type: 'string' } },
      },
    },
    OpenAIModelList: {
      type: 'object',
      properties: {
        object: { type: 'string' },
        data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, object: { type: 'string' }, created: { type: 'integer' }, owned_by: { type: 'string' }, metadata: ref('ModelCatalogEntry') } } },
      },
    },
    AnthropicModelList: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, display_name: { type: 'string' } } } },
        has_more: { type: 'boolean' },
      },
    },
    OpenAIResponsesRequest: { type: 'object', additionalProperties: true, properties: { model: { type: 'string' }, input: {}, stream: { type: 'boolean' } } },
    OpenAIChatCompletionRequest: { type: 'object', additionalProperties: true, properties: { model: { type: 'string' }, messages: { type: 'array', items: { type: 'object', additionalProperties: true } }, stream: { type: 'boolean' } } },
    AnthropicMessageRequest: { type: 'object', additionalProperties: true, properties: { model: { type: 'string' }, messages: { type: 'array', items: { type: 'object', additionalProperties: true } }, max_tokens: { type: 'integer' }, stream: { type: 'boolean' } } },
    OpenAIResponse: { type: 'object', additionalProperties: true },
    OpenAIChatCompletion: { type: 'object', additionalProperties: true },
    AnthropicMessage: { type: 'object', additionalProperties: true },
  };
}

export function GET() {
  return Response.json(openapi, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
