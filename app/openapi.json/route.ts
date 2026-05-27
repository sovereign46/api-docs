export const dynamic = 'force-static';

const bearerSecurity = [{ bearerAuth: [] }];

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

function response(description: string, schema?: unknown) {
  if (!schema) return { description };
  return { description, ...jsonContent(schema) };
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

const errorResponses = {
  '400': response('Invalid request', ref('ErrorResponse')),
  '401': response('Unauthorized', ref('ErrorResponse')),
  '403': response('Forbidden', ref('ErrorResponse')),
  '404': response('Not found', ref('ErrorResponse')),
  '428': response('Polling target is not ready', ref('ErrorResponse')),
  '500': response('Internal error', ref('ErrorResponse')),
};

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Sovereign46 API',
    version: '1.0.0',
    description: 'Production contract for Sovereign46 API clients, CLI integrations, admin tooling, workers, and automation.',
  },
  servers: [
    { url: 'https://api.s46.dev', description: 'Production control plane' },
    { url: 'http://127.0.0.1:8080', description: 'Local development control plane' },
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Account' },
    { name: 'CLI' },
    { name: 'Admin' },
    { name: 'Worker' },
    { name: 'Internal' },
  ],
  paths: {
    '/v1/auth/device/start': {
      post: {
        tags: ['Auth'],
        summary: 'Start invite-gated device login',
        operationId: 'startDeviceLogin',
        requestBody: requestBody(ref('DeviceLoginStartRequest')),
        responses: {
          '202': response('Device login challenge created', ref('DeviceLoginStartResponse')),
          '503': response('Email delivery unavailable', ref('ErrorResponse')),
          ...errorResponses,
        },
      },
    },
    '/v1/auth/device/poll': {
      post: {
        tags: ['Auth'],
        summary: 'Poll device login for approval',
        operationId: 'pollDeviceLogin',
        requestBody: requestBody(ref('DeviceLoginPollRequest')),
        responses: {
          '200': response('Approved token set', ref('TokenSet')),
          ...errorResponses,
        },
      },
    },
    '/v1/auth/magic/consume': {
      get: {
        tags: ['Auth'],
        summary: 'Render magic-link confirmation page',
        operationId: 'confirmMagicLink',
        parameters: [queryParam('token', 'Magic-link token', true)],
        responses: {
          '200': { description: 'HTML confirmation page', content: { 'text/html': { schema: { type: 'string' } } } },
          ...errorResponses,
        },
      },
      post: {
        tags: ['Auth'],
        summary: 'Approve magic-link login',
        operationId: 'approveMagicLink',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: ref('MagicLinkConsumeRequest') },
            'application/x-www-form-urlencoded': { schema: ref('MagicLinkConsumeRequest') },
          },
        },
        responses: {
          '200': { description: 'HTML approval page', content: { 'text/html': { schema: { type: 'string' } } } },
          ...errorResponses,
        },
      },
    },
    '/v1/auth/token/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh and rotate device-bound credentials',
        operationId: 'refreshToken',
        requestBody: requestBody(ref('RefreshTokenRequest'), false),
        responses: {
          '200': response('Refreshed token set', ref('TokenSet')),
          ...errorResponses,
        },
      },
    },
    '/v1/auth/passkeys/register/start': {
      post: {
        tags: ['Auth'],
        summary: 'Start passkey registration for the authenticated user',
        operationId: 'startPasskeyRegistration',
        security: bearerSecurity,
        requestBody: requestBody(ref('EmptyObject')),
        responses: {
          '200': response('WebAuthn registration options', ref('WebAuthnOptions')),
          ...errorResponses,
        },
      },
    },
    '/v1/auth/passkeys/register/finish': {
      post: {
        tags: ['Auth'],
        summary: 'Finish passkey registration',
        operationId: 'finishPasskeyRegistration',
        security: bearerSecurity,
        requestBody: requestBody(ref('WebAuthnRegistrationResponse')),
        responses: {
          '200': response('Passkey registered', ref('PasskeyRegistrationResult')),
          ...errorResponses,
        },
      },
    },
    '/v1/auth/passkeys/login/start': {
      post: {
        tags: ['Auth'],
        summary: 'Start passkey login',
        operationId: 'startPasskeyLogin',
        requestBody: requestBody(ref('PasskeyLoginStartRequest')),
        responses: {
          '200': response('WebAuthn authentication options', ref('WebAuthnOptions')),
          ...errorResponses,
        },
      },
    },
    '/v1/auth/passkeys/login/finish': {
      post: {
        tags: ['Auth'],
        summary: 'Finish passkey login',
        operationId: 'finishPasskeyLogin',
        requestBody: requestBody(ref('WebAuthnAuthenticationResponse')),
        responses: {
          '200': response('Approved token set', ref('TokenSet')),
          ...errorResponses,
        },
      },
    },
    '/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Clear browser auth cookies',
        operationId: 'logout',
        responses: {
          '200': response('Logged out', ref('OKResponse')),
          ...errorResponses,
        },
      },
    },
    '/v1/me': {
      get: {
        tags: ['Account'],
        summary: 'Current authenticated user',
        operationId: 'me',
        security: bearerSecurity,
        responses: {
          '200': response('Current user', ref('User')),
          ...errorResponses,
        },
      },
    },
    '/v1/devices': {
      get: {
        tags: ['Account'],
        summary: 'List paired devices',
        operationId: 'listDevices',
        security: bearerSecurity,
        responses: {
          '200': response('Paired devices', collection('devices', ref('Device'))),
          ...errorResponses,
        },
      },
    },
    '/v1/devices/{deviceId}': {
      delete: {
        tags: ['Account'],
        summary: 'Revoke a paired device',
        operationId: 'deleteDevice',
        security: bearerSecurity,
        parameters: [pathParam('deviceId', 'Device id', 'dev-laptop')],
        responses: {
          '200': response('Device revoked'),
          ...errorResponses,
        },
      },
    },
    '/v1/teams/{team}': {
      get: {
        tags: ['CLI'],
        summary: 'Resolve team metadata',
        operationId: 'team',
        security: bearerSecurity,
        parameters: [
          pathParam('team', 'Canonical team id', '%40s46%2Fengineering'),
          queryParam('endpoint', 'Development endpoint override'),
          queryParam('region', 'Development region override'),
          queryParam('mode', 'Development mode override'),
          queryParam('defaultModel', 'Development default model override'),
        ],
        responses: {
          '200': response('Team metadata', ref('Team')),
          ...errorResponses,
        },
      },
    },
    '/v1/sessions': {
      get: {
        tags: ['CLI'],
        summary: 'List sessions for a team',
        operationId: 'listSessions',
        security: bearerSecurity,
        parameters: [queryParam('team', 'Canonical team id', true)],
        responses: {
          '200': response('Sessions', collection('sessions', ref('Session'))),
          ...errorResponses,
        },
      },
    },
    '/v1/sessions/{sessionId}/detach': sessionAction('detach', ref('DetachRequest'), ref('Session')),
    '/v1/sessions/{sessionId}/resume': sessionAction('resume', ref('ResumeRequest'), ref('Session')),
    '/v1/sessions/{sessionId}/attach': sessionAction('attach', ref('AttachRequest'), ref('AttachResult')),
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
      delete: {
        tags: ['Admin'],
        summary: 'Remove organization member',
        operationId: 'deleteOrganizationMember',
        security: bearerSecurity,
        parameters: [queryParam('organization', 'Organization slug', true), queryParam('email', 'Member email', true)],
        responses: {
          '200': response('Removed', ref('RemovedResponse')),
          ...errorResponses,
        },
      },
    },
    '/v1/admin/organization-roles': {
      get: adminGet('List organization roles', 'listOrganizationRoles', { type: 'object', properties: { roles: { type: 'array', items: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'] } } } }),
    },
    '/v1/admin/people': {
      get: adminGet('List people', 'listPeople', collection('people', ref('Person')), [queryParam('organization', 'Organization slug', true), queryParam('team', 'Canonical team id')]),
    },
    '/v1/admin/people/invite': {
      post: adminWrite('Invite person', 'invitePerson', ref('InviteRequest'), ref('Invitation')),
    },
    '/v1/admin/people/{email}': {
      get: adminGet('Get person', 'getPerson', ref('Person'), [pathParam('email', 'Email address', 'dscape%40s46.dev'), queryParam('organization', 'Organization slug', true)]),
      put: adminWrite('Update person status', 'putPerson', ref('PersonStatusRequest'), ref('Person'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev')]),
      patch: adminWrite('Patch person status', 'patchPerson', ref('PersonStatusRequest'), ref('Person'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev')]),
    },
    '/v1/admin/people/{email}/teams': {
      post: adminWrite('Add person to team', 'addPersonTeam', ref('TeamMembership'), ref('TeamMembership'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev')]),
      put: adminWrite('Update person team membership', 'putPersonTeam', ref('TeamMembership'), ref('TeamMembership'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev')]),
    },
    '/v1/admin/people/{email}/teams/{team}': {
      delete: {
        tags: ['Admin'],
        summary: 'Remove person from team',
        operationId: 'deletePersonTeam',
        security: bearerSecurity,
        parameters: [pathParam('email', 'Email address', 'dscape%40s46.dev'), pathParam('team', 'Canonical team id', '%40s46%2Fengineering')],
        responses: {
          '200': response('Removed', ref('RemovedResponse')),
          ...errorResponses,
        },
      },
    },
    '/v1/admin/people/{email}/devices/{deviceId}/revoke': {
      post: adminWrite('Revoke person device', 'revokePersonDevice', { type: 'object' }, ref('RevokedDeviceResponse'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev'), pathParam('deviceId', 'Device id', 'dev-laptop'), queryParam('organization', 'Organization slug', true)]),
    },
    '/v1/admin/people/{email}/invites/resend': {
      post: adminWrite('Resend invitation', 'resendInvite', { type: 'object' }, ref('InvitationResponse'), '200', [pathParam('email', 'Email address', 'dscape%40s46.dev'), queryParam('organization', 'Organization slug', true)]),
    },
    '/v1/admin/people/{email}/audit': {
      get: adminGet('Person audit events', 'personAudit', collection('auditEvents', ref('AuditEvent')), [pathParam('email', 'Email address', 'dscape%40s46.dev'), queryParam('organization', 'Organization slug', true), queryParam('team', 'Canonical team id'), queryParam('limit', 'Maximum events')]),
    },
    '/v1/admin/invites': {
      get: adminGet('List invitations', 'listInvites', collection('invitations', ref('Invitation')), [queryParam('team', 'Canonical team id'), queryParam('status', 'Invitation status'), queryParam('limit', 'Maximum invitations')]),
    },
    '/v1/admin/invite/revoke': {
      post: adminWrite('Revoke invitation', 'revokeInvite', ref('RevokeInviteRequest'), ref('Invitation')),
    },
    '/v1/admin/models': {
      get: adminGet('List models', 'listModels', collection('models', ref('ModelCatalogEntry'))),
      post: adminWrite('Create model catalog entry', 'createModel', ref('ModelCatalogEntry'), ref('ModelCatalogEntry')),
      put: adminWrite('Update model catalog entry', 'putModel', ref('ModelCatalogEntry'), ref('ModelCatalogEntry')),
    },
    '/v1/admin/teams': {
      get: adminGet('List teams', 'listAdminTeams', collection('teams', ref('Team')), [queryParam('team', 'Canonical team id')]),
      post: adminWrite('Create team', 'createTeam', ref('Team'), ref('Team')),
    },
    '/v1/admin/teams/{team}': {
      get: adminGet('Get team', 'getAdminTeam', ref('Team'), [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
      put: adminWrite('Update team', 'putTeam', ref('Team'), ref('Team'), '200', [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
      patch: adminWrite('Patch team', 'patchTeam', ref('Team'), ref('Team'), '200', [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
      delete: {
        tags: ['Admin'],
        summary: 'Delete team',
        operationId: 'deleteTeam',
        security: bearerSecurity,
        parameters: [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')],
        responses: {
          '200': response('Deleted', ref('DeletedTeamResponse')),
          ...errorResponses,
        },
      },
    },
    '/v1/admin/harness-policies': {
      get: adminGet('Get harness policy by query', 'getHarnessPolicyByQuery', ref('HarnessPolicy'), [queryParam('team', 'Canonical team id')]),
      post: adminWrite('Save harness policy', 'saveHarnessPolicyByQuery', ref('HarnessPolicy'), ref('HarnessPolicy')),
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
    '/v1/admin/workers': {
      get: adminGet('List workers', 'listWorkers', collection('workers', ref('Worker')), [queryParam('team', 'Canonical team id'), queryParam('kind', 'Worker kind'), queryParam('region', 'Region'), queryParam('state', 'Worker state')]),
    },
    '/v1/admin/workers/{id}': {
      get: adminGet('Get worker with recent logs', 'getWorker', { type: 'object', properties: { worker: ref('Worker'), logs: { type: 'array', items: ref('WorkerLog') } } }, [pathParam('id', 'Worker id', 'worker_01')]),
    },
    '/v1/admin/workers/{id}/logs': {
      get: adminGet('Read worker logs', 'workerLogs', collection('logs', ref('WorkerLog')), [pathParam('id', 'Worker id', 'worker_01'), queryParam('limit', 'Maximum log rows')]),
    },
    '/v1/admin/workers/{id}/drain': {
      post: adminWrite('Drain worker', 'drainWorker', { type: 'object' }, ref('Worker'), '200', [pathParam('id', 'Worker id', 'worker_01')]),
    },
    '/v1/admin/workers/{id}/revoke': {
      post: adminWrite('Revoke worker', 'revokeWorker', { type: 'object' }, ref('Worker'), '200', [pathParam('id', 'Worker id', 'worker_01')]),
    },
    '/v1/admin/jobs': {
      get: adminGet('List jobs', 'listJobs', collection('jobs', ref('Job')), [queryParam('team', 'Canonical team id'), queryParam('state', 'Job state'), queryParam('sessionId', 'Session id'), queryParam('kind', 'Job kind')]),
      post: adminWrite('Enqueue job', 'enqueueJob', ref('JobSpec'), ref('Job'), '202'),
    },
    '/v1/admin/jobs/{id}/logs': {
      get: adminGet('Read job logs', 'jobLogs', collection('logs', ref('JobLog')), [pathParam('id', 'Job id', 'job_01'), queryParam('limit', 'Maximum log rows')]),
    },
    '/v1/admin/jobs/{id}/cancel': {
      post: adminWrite('Cancel job', 'cancelJob', { type: 'object' }, ref('Job'), '200', [pathParam('id', 'Job id', 'job_01')]),
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
      post: adminWrite('Reconcile expired leases', 'reconcileLeases', { type: 'object' }, { type: 'object', properties: { updated: { type: 'integer' } } }),
    },
    '/v1/worker/register': {
      post: {
        tags: ['Worker'],
        summary: 'Register a worker',
        operationId: 'registerWorker',
        security: bearerSecurity,
        requestBody: requestBody(ref('WorkerRegistration')),
        responses: {
          '201': response('Registered worker and token', ref('WorkerRegistrationResult')),
          ...errorResponses,
        },
      },
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
      post: {
        tags: ['Internal'],
        summary: 'Acknowledge a lease internally',
        operationId: 'ackLease',
        security: bearerSecurity,
        requestBody: requestBody(ref('LeaseAckRequest')),
        responses: {
          '202': response('Acknowledged', ref('AcknowledgedResponse')),
          ...errorResponses,
        },
      },
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
    post: {
      tags: ['CLI'],
      summary: `${action[0]?.toUpperCase() ?? ''}${action.slice(1)} session`,
      operationId: `${action}Session`,
      security: bearerSecurity,
      parameters: [pathParam('sessionId', 'Session id', '%40dscape%2Fauth-redirect-fix'), queryParam('team', 'Canonical team id', true)],
      requestBody: requestBody(input),
      responses: {
        '200': response('Session action result', output),
        ...errorResponses,
      },
    },
  };
}

function adminGet(summary: string, operationId: string, output: unknown, parameters: unknown[] = []) {
  return {
    tags: ['Admin'],
    summary,
    operationId,
    security: bearerSecurity,
    parameters,
    responses: {
      '200': response(summary, output),
      ...errorResponses,
    },
  };
}

function adminWrite(summary: string, operationId: string, input: unknown, output: unknown, success = '200', parameters: unknown[] = []) {
  return {
    tags: ['Admin'],
    summary,
    operationId,
    security: bearerSecurity,
    parameters,
    requestBody: requestBody(input),
    responses: {
      [success]: response(summary, output),
      ...errorResponses,
    },
  };
}

function workerWrite(summary: string, operationId: string, input: unknown, output: unknown) {
  return {
    tags: ['Worker'],
    summary,
    operationId,
    security: bearerSecurity,
    requestBody: requestBody(input),
    responses: {
      '200': response(summary, output),
      ...errorResponses,
    },
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
          },
        },
      },
    },
    EmptyObject: { type: 'object', additionalProperties: false },
    OKResponse: { type: 'object', properties: { ok: { type: 'boolean' } } },
    RemovedResponse: { type: 'object', properties: { removed: { type: 'boolean' } } },
    DeletedTeamResponse: { type: 'object', properties: { deleted: { type: 'boolean' }, team: { type: 'string' } } },
    RevokedDeviceResponse: { type: 'object', properties: { revoked: { type: 'boolean' }, deviceId: { type: 'string' } } },
    InvitationResponse: { type: 'object', properties: { invitation: ref('Invitation'), emailSent: { type: 'boolean' } } },
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
      required: ['email', 'team', 'role'],
      properties: {
        email: { type: 'string', format: 'email' },
        team: { type: 'string' },
        role: { type: 'string', enum: ['owner', 'admin', 'member', 'viewer'] },
      },
    },
    RevokeInviteRequest: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
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
        createdAt: timestamp,
        updatedAt: timestamp,
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
    WorkerModel: workerModel,
    Capacity: capacity,
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
    JobCompletion: { type: 'object', properties: { state: { type: 'string', enum: ['succeeded', 'failed', 'canceled'] }, payload: stringMap, usage: ref('UsageEvent') } },
    CompleteJobRequest: { type: 'object', required: ['workerId', 'jobId', 'leaseId', 'completion'], properties: { workerId: { type: 'string' }, jobId: { type: 'string' }, leaseId: { type: 'string' }, completion: ref('JobCompletion') } },
    RetryJobRequest: { type: 'object', properties: { runAfter: timestamp } },
    LeaseAckRequest: { type: 'object', required: ['workerId', 'jobId', 'leaseId'], properties: { workerId: { type: 'string' }, jobId: { type: 'string' }, leaseId: { type: 'string' } } },
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
  };
}

export function GET() {
  return Response.json(openapi, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
