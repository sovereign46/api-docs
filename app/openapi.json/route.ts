export const dynamic = 'force-static';

type SecurityRequirement = Array<Record<string, string[]>>;

const bearerSecurity: SecurityRequirement = [{ bearerAuth: [] }];
const operatorSecurity: SecurityRequirement = [{ operatorBearerAuth: [] }, { operatorAdminHeader: [] }];
const gatewayServers = [{ url: 'https://gateway.s46.dev', description: 'Production harness gateway' }];
const workerAdminAccess = {
  security: [...bearerSecurity, ...operatorSecurity],
  description: 'Requires admin admission, then authorization against the stored worker team, else organization. Global workers (both scopes empty) require operator credentials. Request scope hints do not replace the persisted resource scope.',
};

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
  '400': response('invalid_request, bad_json, or unsupported_feature (unsupported protocol feature)', ref('ErrorResponse')),
  '401': response('Unauthorized', ref('ErrorResponse')),
  '403': response('Forbidden', ref('ErrorResponse')),
  '404': response('Not found', ref('ErrorResponse')),
  '405': response('Method not allowed', ref('ErrorResponse')),
  '409': response('Conflict', ref('ErrorResponse')),
  '410': response('Expired', ref('ErrorResponse')),
  '412': response('Precondition failed', ref('ErrorResponse')),
  '428': response('Authorization pending or precondition required', ref('ErrorResponse')),
  '429': response('rate_limited', ref('ErrorResponse')),
  '500': response('Internal error', ref('ErrorResponse')),
  '502': response('upstream_error: model upstream request or response failed', ref('ErrorResponse')),
  '503': response('Service unavailable; model_registry_unavailable means independent registry verification is unavailable, serving_authority_unavailable means exact serving authority is unavailable, and model_unavailable means no protected serving route is available', ref('ErrorResponse')),
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

function authenticatedGet(tags: string[], summary: string, operationId: string, output: unknown, parameters: unknown[] = [], servers?: unknown[]) {
  return operation(tags, summary, operationId, {
    parameters,
    servers,
    responses: {
      '200': response(summary, output),
      ...errorResponses,
    },
  });
}

function teamGet(output: unknown, parameters: unknown[]) {
  return operation(['Teams and sessions'], 'Resolve team settings and compatibility metadata', 'team', {
    parameters,
    responses: {
      '200': response('Team settings and compatibility metadata', output),
      ...errorResponses,
      '503': response('model_registry_unavailable: independent registry verification is unavailable', ref('ErrorResponse')),
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

function gatewayModelGet(summary: string, operationId: string, output: unknown) {
  return authenticatedGet(['Harness gateway'], summary, operationId, output, [], gatewayServers);
}

function gatewayPost(summary: string, operationId: string, input: unknown, output: unknown) {
  return {
    ...operation(['Harness gateway'], summary, operationId, {
      security: bearerSecurity,
      servers: gatewayServers,
      requestBody: requestBody(input),
      responses: {
        '200': {
          description: `${summary}. Streaming errors are reported in the event stream after headers are sent.`,
          content: {
            'application/json': { schema: output },
            'text/event-stream': { schema: { type: 'string' } },
          },
        },
        ...errorResponses,
        '429': response('rate_limited or monthly_cap_exceeded; cap failure occurs before upstream dispatch', ref('ErrorResponse')),
      },
    }),
    description: 'Production requires bearer authentication, current independent registry verification, exact signed serving authority, a matching exact-release team grant, and synchronous usage reservation before dispatch over the protected route. Explicitly sync-disabled development and airplane mode use separate local behavior. See /docs/gateway for protocol subsets and stream events.',
  };
}

const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Sovereign46 API',
    version: 'unreleased',
    description: 'Current source contract for Sovereign46 API consumers, including exact-release grants, signed serving authority, and synchronous gateway accounting. This document does not supply production evidence or establish deployed availability. See /docs#release-status.',
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
      get: operation(['Operations'], 'Readiness check', 'readyz', {
        security: null,
        responses: {
          '200': response('Configured database, registry, serving-authority, exact-grant, and worst-case-capacity checks passed', ref('ReadyResponse')),
          '405': errorResponses['405'],
          '503': response('Database, independent registry verification, or serving authority unavailable; this status body is not an ErrorResponse', ref('ReadyResponse')),
        },
      }),
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
      get: teamGet(ref('Team'), [
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
      get: adminGet('List stored team settings, not authorized model discovery', 'listAdminTeams', collection('teams', ref('Team')), [queryParam('team', 'Canonical team id')]),
      post: adminWrite('Create team', 'createTeam', ref('Team'), ref('Team')),
    },
    '/v1/admin/teams/{team}': {
      get: {
        ...adminGet('Read stored team settings, not authorized model discovery', 'getAdminTeam', ref('Team'), [pathParam('team', 'Canonical team id', '%40s46%2Fengineering')]),
        description: 'On a running service, registry verification outages do not block settings reads. Existing authentication and scope checks still apply. Use authenticated gateway GET /v1/models for exact-grant production discovery and authoritative active runtime metadata.',
      },
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
    '/v1/admin/model-releases': {
      get: modelAdminGet('List API-backed model releases', 'listModelReleases', collection('modelReleases', ref('ModelRelease')), [queryParam('namespace', 'Model namespace'), queryParam('team', 'Canonical team id'), queryParam('state', 'Release state')]),
      post: modelAdminWrite('Create model release', 'createModelRelease', ref('CreateModelReleaseRequest'), ref('ModelRelease'), '201'),
    },
    '/v1/admin/model-releases/{releaseId}': {
      get: modelAdminGet('Get model release', 'getModelRelease', ref('ModelRelease'), [pathParam('releaseId', 'Model release id', 'rel_...')]),
    },
    '/v1/admin/model-releases/{releaseId}/upload-session': {
      post: modelAdminWrite('Create model upload session', 'createModelUploadSession', ref('ModelUploadSessionRequest'), ref('ModelUploadSessionResponse'), '201', [pathParam('releaseId', 'Model release id', 'rel_...'), headerParam('If-Match', 'Known release ETag/revision', true)]),
    },
    '/v1/admin/model-releases/{releaseId}/finalize-upload': {
      post: modelAdminWrite('Finalize model upload into quarantine CAS metadata', 'finalizeModelUpload', ref('FinalizeModelUploadRequest'), ref('ModelRelease'), '200', [pathParam('releaseId', 'Model release id', 'rel_...'), headerParam('If-Match', 'Known release ETag/revision', true), headerParam('Idempotency-Key', 'Idempotency key for safe retry', true)]),
    },
    '/v1/admin/model-releases/{releaseId}/validate': {
      post: modelAdminWrite('Queue model certification', 'queueModelCertification', ref('ModelValidationRequest'), ref('ModelRelease'), '202', [pathParam('releaseId', 'Model release id', 'rel_...'), headerParam('If-Match', 'Known release ETag/revision', true), headerParam('Idempotency-Key', 'Idempotency key for safe retry', true)]),
    },
    '/v1/admin/model-releases/{releaseId}/publish': {
      post: modelAdminWrite('Queue registry publication', 'queueModelPublication', ref('ModelPublishRequest'), ref('ModelRelease'), '202', [pathParam('releaseId', 'Model release id', 'rel_...'), headerParam('If-Match', 'Known release ETag/revision', true), headerParam('Idempotency-Key', 'Idempotency key for safe retry', true)]),
    },
    '/v1/admin/model-releases/{releaseId}/yank': {
      post: modelAdminWrite('Queue signed model yank and block serving', 'queueModelYank', ref('ModelYankRequest'), ref('ModelRelease'), '202', [pathParam('releaseId', 'Model release id', 'rel_...'), headerParam('If-Match', 'Known release ETag/revision', true), headerParam('Idempotency-Key', 'Idempotency key for safe retry', true)]),
    },
    '/v1/admin/models': {
      get: modelAdminGet('Inspect registry catalog, exact release identities, and grant state', 'listModels', ref('ModelCatalogResponse'), [queryParam('organization', 'Organization slug'), queryParam('team', 'Canonical team id; includes legacy policies and exact-release grants when supplied'), queryParam('model', 'Public model ID filter for exact release identities')]),
    },
    '/v1/admin/model-policies': {
      get: modelAdminGet('List retired team model-ID policies', 'listModelPolicies', collection('modelPolicies', ref('TeamModelPolicy')), [queryParam('team', 'Canonical team id', true)]),
      put: modelAdminWrite('Revoke a legacy team model-ID policy', 'putModelPolicy', ref('TeamModelPolicyRequest'), ref('TeamModelPolicy'), '200', [queryParam('team', 'Canonical team id when omitted from the body'), queryParam('model', 'Public model ID when omitted from the body'), headerParam('Idempotency-Key', 'Idempotency key for safe retry', true), headerParam('If-Match', 'Existing policy ETag/revision; legacy policies cannot be created or re-enabled', true)]),
      patch: modelAdminWrite('Revoke a legacy team model-ID policy', 'patchModelPolicy', ref('TeamModelPolicyRequest'), ref('TeamModelPolicy'), '200', [queryParam('team', 'Canonical team id when omitted from the body'), queryParam('model', 'Public model ID when omitted from the body'), headerParam('Idempotency-Key', 'Idempotency key for safe retry', true), headerParam('If-Match', 'Existing policy ETag/revision; legacy policies cannot be created or re-enabled', true)]),
    },
    '/v1/admin/model-release-grants': {
      get: modelAdminGet('List exact-release grants for a team', 'listModelReleaseGrants', collection('modelReleaseGrants', ref('TeamModelReleaseGrant')), [queryParam('team', 'Canonical team id', true)]),
      put: modelAdminWrite('Create, revoke, or update an exact-release grant', 'putModelReleaseGrant', ref('TeamModelReleaseGrantRequest'), ref('TeamModelReleaseGrant'), '200', [queryParam('team', 'Canonical team id when omitted from the body'), queryParam('release', 'Exact sha256 release ID when omitted from the body'), headerParam('Idempotency-Key', 'Idempotency key for safe retry', true), headerParam('If-Match', 'Required for an existing grant; omit when creating a grant')]),
      patch: modelAdminWrite('Create, revoke, or update an exact-release grant', 'patchModelReleaseGrant', ref('TeamModelReleaseGrantRequest'), ref('TeamModelReleaseGrant'), '200', [queryParam('team', 'Canonical team id when omitted from the body'), queryParam('release', 'Exact sha256 release ID when omitted from the body'), headerParam('Idempotency-Key', 'Idempotency key for safe retry', true), headerParam('If-Match', 'Required for an existing grant; omit when creating a grant')]),
    },
    '/v1/admin/serving-authority': {
      get: operation(['Models'], 'Inspect current non-secret serving-authority metadata', 'getServingAuthority', {
        security: operatorSecurity,
        responses: {
          '200': response('Current serving-authority heads and expiry times', collection('data', ref('ServingAuthorityView'))),
          '403': response('Configured operator credentials required; tenant credentials are not accepted', ref('ErrorResponse')),
          '405': errorResponses['405'],
          '500': errorResponses['500'],
          '503': response('serving_authority_unavailable', ref('ErrorResponse')),
        },
      }),
    },
    '/v1/admin/workers': {
      get: adminGet('List workers', 'listWorkers', collection('workers', ref('Worker')), [queryParam('team', 'Canonical team id'), queryParam('kind', 'Worker kind'), queryParam('region', 'Region'), queryParam('state', 'Worker state')]),
    },
    '/v1/admin/workers/{id}': {
      get: { ...adminGet('Get worker with recent logs', 'getWorker', ref('WorkerWithLogs'), [pathParam('id', 'Worker id', 'worker_01')]), ...workerAdminAccess },
    },
    '/v1/admin/workers/{id}/logs': {
      get: { ...adminGet('Read worker logs', 'workerLogs', collection('logs', ref('WorkerLog')), [pathParam('id', 'Worker id', 'worker_01'), queryParam('limit', 'Maximum log rows')]), ...workerAdminAccess },
    },
    '/v1/admin/workers/{id}/drain': {
      post: { ...adminWrite('Drain worker', 'drainWorker', ref('EmptyObject'), ref('Worker'), '200', [pathParam('id', 'Worker id', 'worker_01')]), ...workerAdminAccess },
    },
    '/v1/admin/workers/{id}/revoke': {
      post: { ...adminWrite('Revoke worker', 'revokeWorker', ref('EmptyObject'), ref('Worker'), '200', [pathParam('id', 'Worker id', 'worker_01')]), ...workerAdminAccess },
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
      post: {
        ...operation(['Worker control'], 'Provision worker with operator credentials', 'registerWorker', {
          security: operatorSecurity,
          requestBody: requestBody(ref('WorkerRegistration')),
          responses: {
            '201': response('Worker provisioned; returned credential is for subsequent worker calls, not provisioning', ref('WorkerRegistrationResult')),
            '400': response('invalid_request: invalid registration or conflicting organization/team scope', ref('ErrorResponse')),
            '403': response('forbidden: configured operator credentials required; tenant owner/admin/team-admin/viewer and worker credentials cannot register any scope or replace any worker ID', ref('ErrorResponse')),
            '404': response('not_found: referenced team or organization does not exist', ref('ErrorResponse')),
            '405': errorResponses['405'],
            '409': errorResponses['409'],
            '500': errorResponses['500'],
            '503': response('service_unavailable: control service unavailable', ref('ErrorResponse')),
          },
        }),
        description: 'Production provisioning requires the configured S46_ADMIN_TOKEN for every scope and worker ID, including replacements. Non-production retains bootstrap access only when no operator token is configured. The operator-only boundary does not retroactively revoke issued credentials; same-ID replacement rotates that worker credential. Provisioning is not VM, loaded-model, or certification attestation.',
      },
    },
    '/v1/worker/heartbeat': {
      post: workerWrite('Heartbeat worker', 'heartbeatWorker', ref('WorkerHeartbeatEnvelope'), ref('Worker')),
    },
    '/v1/worker/jobs/lease': {
      post: {
        ...workerWrite('Lease a job', 'leaseJob', ref('LeaseRequest'), ref('LeaseResult')),
        description: 'Leasing checks current stored worker fields and credential under the lease lock. Nonempty organization scope and optional team scope constrain matching; both empty intentionally permit a cross-organization operator pool. Model lifecycle jobs require model_certification for model.certify or model_registry_publish for model.publish/model.yank, regardless of advertised model IDs. These checks do not attest workload execution.',
      },
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
      get: gatewayModelGet('OpenAI-compatible authorized model list', 'openAIModels', ref('OpenAIModelList')),
    },
    '/v1/responses': {
      post: gatewayPost('OpenAI Responses-compatible request', 'openAIResponses', ref('OpenAIResponsesRequest'), ref('OpenAIResponse')),
    },
    '/v1/chat/completions': {
      post: gatewayPost('OpenAI Chat Completions-compatible request', 'openAIChatCompletions', ref('OpenAIChatCompletionRequest'), ref('OpenAIChatCompletion')),
    },
    '/anthropic/v1/models': {
      get: gatewayModelGet('Anthropic-compatible authorized model list', 'anthropicModels', ref('AnthropicModelList')),
    },
    '/anthropic/v1/messages': {
      post: gatewayPost('Anthropic Messages-compatible request', 'anthropicMessages', ref('AnthropicMessageRequest'), ref('AnthropicMessage')),
    },
    '/codex/v1/models': {
      get: gatewayModelGet('Codex/OpenAI-compatible authorized model list', 'codexModels', ref('OpenAIModelList')),
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
      operatorBearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Configured S46_ADMIN_TOKEN, not a tenant user token or worker credential. Keep this operator secret out of tenant clients.',
      },
      operatorAdminHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-S46-Admin-Token',
        description: 'Alternative transport for the configured S46_ADMIN_TOKEN; used only when no bearer credential is supplied.',
      },
    },
    schemas: buildSchemas(),
  },
};

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
    ExactSHA256: {
      type: 'string',
      pattern: '^sha256:[0-9a-f]{64}$',
      description: 'Exact SHA-256 identity encoded as sha256: followed by 64 lowercase hexadecimal characters.',
    },
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
    ReadyResponse: {
      type: 'object',
      required: ['status', 'database'],
      properties: {
        status: { type: 'string', enum: ['ok', 'unavailable'] },
        database: { type: 'string', enum: ['ok', 'disabled', 'unavailable'] },
        modelRegistry: { type: 'string', enum: ['ok', 'unavailable'], description: 'Present after the database check when model control is configured.' },
        servingAuthority: { type: 'string', enum: ['ok', 'unavailable'], description: 'Present after the database check. A registry failure also marks serving authority unavailable.' },
      },
      examples: [
        { status: 'ok', database: 'ok', modelRegistry: 'ok', servingAuthority: 'ok' },
        { status: 'ok', database: 'disabled', modelRegistry: 'ok', servingAuthority: 'ok' },
        { status: 'unavailable', database: 'unavailable' },
        { status: 'unavailable', database: 'ok', modelRegistry: 'unavailable', servingAuthority: 'unavailable' },
        { status: 'unavailable', database: 'disabled', modelRegistry: 'unavailable', servingAuthority: 'unavailable' },
        { status: 'unavailable', database: 'ok', modelRegistry: 'ok', servingAuthority: 'unavailable' },
      ],
    },
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
      description: 'Shared team settings shape. The models and modelMetadata fields on GET /v1/teams/{team} are compatibility fields, not exact serving-authority discovery. Admin routes expose configured settings. Use authenticated gateway GET /v1/models for authoritative production discovery.',
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
        defaultModel: { type: 'string', description: 'Configured preference. Validate it against authenticated gateway model discovery; neither this field nor the team compatibility list proves current authorization.' },
        models: { type: ['array', 'null'], items: { type: 'string' }, description: 'Compatibility model IDs, not authoritative exact serving-authority discovery. Admin responses contain configured IDs (possibly null). Use authenticated gateway GET /v1/models for production authorization.' },
        modelMetadata: { type: ['object', 'null'], additionalProperties: ref('ModelRuntime'), description: 'Compatibility runtime metadata, not authoritative exact serving-authority discovery. Admin/local settings may return null; stored or submitted metadata does not establish serving trust.' },
        monthlyCapMicros: { type: 'integer', format: 'int64', minimum: 0 },
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
    ModelRuntime: {
      type: 'object',
      description: 'Signed registry metadata, not verification of loaded checkpoint bytes. Optional fields may be absent.',
      required: ['reasoning'],
      properties: {
        engine: { type: 'string' },
        version: { type: 'string' },
        profileSha256: { type: 'string' },
        closureSha256: { type: 'string' },
        closureSizeBytes: { type: 'integer', format: 'int64' },
        contextWindow: { type: 'integer' },
        maxTokens: { type: 'integer' },
        reasoning: { type: 'boolean', description: 'Model capability; does not imply adapter support for reasoning controls.' },
        minMemoryBytes: { type: 'integer', format: 'int64' },
        recommendedMemoryBytes: { type: 'integer', format: 'int64' },
      },
    },
    ModelCatalogEntry: {
      type: 'object',
      properties: {
        releaseId: { ...ref('ExactSHA256'), description: 'Immutable sha256 identity of the exact authenticated registry manifest bytes; distinct from rel_ API lifecycle IDs.' },
        format: { type: 'string', enum: ['gguf', 'safetensors'], description: 'Native safetensors use a package.json inventory; older manifests may omit format.' },
        runtime: ref('ModelRuntime'),
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
        certified: { type: 'boolean', description: 'Release/audit evidence passed for this registry entry; not an attestation of currently loaded runtime bytes.' },
        published: { type: 'boolean', description: 'Release is represented in the verified registry; does not imply activation or serving availability.' },
        yanked: { type: 'boolean' },
        advisoryBlocked: { type: 'boolean' },
        globallyBlocked: { type: 'boolean' },
        sigsumStatus: { type: 'string', description: 'Transparency state observed during registry verification; not a permanent live-health or activation badge.' },
        verificationState: { type: 'string', description: 'Registry-document verification state, separate from loaded-runtime identity and availability.' },
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
      required: ['models', 'modelReleaseIdentities'],
      properties: {
        models: { type: 'array', items: ref('ModelCatalogEntry') },
        modelReleaseIdentities: { type: 'array', maxItems: 1000, items: ref('ModelReleaseIdentity') },
        modelPolicies: { type: 'array', items: ref('TeamModelPolicy'), description: 'Retired model-ID-wide policy history; included only when team is supplied.' },
        modelReleaseGrants: { type: 'array', items: ref('TeamModelReleaseGrant'), description: 'Exact-release grants; included only when team is supplied.' },
      },
    },
    ModelReleaseIdentity: {
      type: 'object',
      description: 'Append-only identity of exact authenticated registry manifest bytes. This sha256 release ID is distinct from the mutable rel_ API release-workflow resource.',
      properties: {
        id: ref('ExactSHA256'),
        modelId: { type: 'string' },
        version: { type: 'string' },
        format: { type: 'string', enum: ['', 'gguf', 'safetensors'], description: 'Historical Devstral identities use the empty value.' },
        filename: { type: 'string' },
        backendModel: { type: 'string' },
        manifestSha256: ref('ExactSHA256'),
        manifestSizeBytes: { type: 'integer', format: 'int64' },
        manifestSignatureSha256: ref('ExactSHA256'),
        manifestSignatureSizeBytes: { type: 'integer', format: 'int64' },
        manifestSigningKeyId: { type: 'string' },
        manifestSigningIssuer: { type: 'string' },
        manifestSigningSubject: { type: 'string' },
        artifactSha256: ref('ExactSHA256'),
        artifactSizeBytes: { type: 'integer', format: 'int64' },
        artifactDigest: ref('ExactSHA256'),
        bundleDigest: ref('ExactSHA256'),
        releaseSignatureSubjectDigest: ref('ExactSHA256'),
        runtime: ref('ModelRuntime'),
        runtimeIdentitySha256: ref('ExactSHA256'),
        registryCreatedAt: timestamp,
        createdAt: timestamp,
      },
    },
    CreateModelReleaseRequest: {
      type: 'object',
      required: ['namespace', 'team', 'modelSlug'],
      properties: { namespace: { type: 'string' }, team: { type: 'string' }, modelSlug: { type: 'string' } },
    },
    ModelArtifact: {
      type: 'object',
      properties: {
        digest: { type: 'string' }, sha256: { type: 'string' }, size: { type: 'integer' }, contentType: { type: 'string' }, filename: { type: 'string' }, storageUri: { type: 'string' }, quarantineUri: { type: 'string' }, casUri: { type: 'string' }, uploadedAt: timestamp,
      },
    },
    ModelUploadSessionRequest: {
      type: 'object',
      required: ['artifact'],
      properties: { artifact: { type: 'object', required: ['sha256', 'size'], properties: { sha256: { type: 'string' }, size: { type: 'integer' }, contentType: { type: 'string' }, filename: { type: 'string' }, partCount: { type: 'integer' } } } },
    },
    ModelUploadSession: {
      type: 'object',
      properties: { id: { type: 'string' }, releaseId: { type: 'string' }, namespace: { type: 'string' }, modelSlug: { type: 'string' }, artifactDigest: { type: 'string' }, artifactSize: { type: 'integer' }, uploadUrl: { type: 'string' }, method: { type: 'string' }, headers: { type: 'object', additionalProperties: { type: 'string' } }, state: { type: 'string' }, expiresAt: timestamp, createdAt: timestamp, finalizedAt: timestamp },
    },
    ModelUploadSessionResponse: { type: 'object', properties: { uploadSession: ref('ModelUploadSession'), modelRelease: ref('ModelRelease') } },
    FinalizeModelUploadRequest: { type: 'object', required: ['uploadSessionId', 'sha256', 'size'], properties: { uploadSessionId: { type: 'string' }, sha256: { type: 'string' }, size: { type: 'integer' } } },
    ModelValidationRequest: { type: 'object', properties: { estimatedGpuHours: { type: 'integer' } } },
    ModelPublishRequest: { type: 'object', properties: {} },
    ModelYankRequest: { type: 'object', properties: { reason: { type: 'string' } } },
    ModelCertificationRecord: {
      type: 'object',
      properties: {
        schema: { type: 'string' }, releaseId: { type: 'string' }, modelId: { type: 'string' }, version: { type: 'string' }, artifactDigest: { type: 'string' }, artifactSize: { type: 'integer' }, backendModel: { type: 'string' }, result: { type: 'string' }, summary: { type: 'string' }, sigsumStatus: { type: 'string' }, transparencyLogUrl: { type: 'string' }, createdAt: timestamp,
        verificationSuite: { type: 'object', properties: { version: { type: 'string' }, runnerImageDigest: { type: 'string' }, policyDigest: { type: 'string' }, privateHoldoutSetId: { type: 'string' } } },
        evidenceDigests: { type: 'array', items: { type: 'string' } },
        thresholdSignatures: { type: 'object', properties: { subjectDigest: { type: 'string' }, threshold: { type: 'integer' }, state: { type: 'string' }, signatures: { type: 'array', items: { type: 'object', properties: { keyId: { type: 'string' }, signer: { type: 'string' }, signatureDigest: { type: 'string' }, signedAt: timestamp } } } } },
      },
    },
    ModelPublicationRecord: { type: 'object', properties: { schema: { type: 'string' }, releaseId: { type: 'string' }, modelId: { type: 'string' }, version: { type: 'string' }, artifactUrl: { type: 'string' }, manifestUrl: { type: 'string' }, indexUrl: { type: 'string' }, registryRef: { type: 'string' }, sigsumStatus: { type: 'string' }, publishedAt: timestamp } },
    ModelYankRecord: { type: 'object', properties: { schema: { type: 'string' }, releaseId: { type: 'string' }, modelId: { type: 'string' }, version: { type: 'string' }, artifactDigest: { type: 'string' }, releaseCertificateDigest: { type: 'string' }, reason: { type: 'string' }, effectiveAt: timestamp, loggedAt: timestamp } },
    ModelRelease: {
      type: 'object',
      properties: {
        id: { type: 'string' }, schema: { type: 'string' }, namespace: { type: 'string' }, organizationSlug: { type: 'string' }, teamSlug: { type: 'string' }, modelSlug: { type: 'string' }, modelId: { type: 'string' }, version: { type: 'string' }, state: { type: 'string', enum: ['staged', 'certifying', 'certified', 'publishing', 'published', 'yanking', 'yanked', 'failed'] }, backendModel: { type: 'string' }, servingBlocked: { type: 'boolean' }, certificationJobId: { type: 'string' }, publishJobId: { type: 'string' }, yankJobId: { type: 'string' }, estimatedGpuHours: { type: 'integer' }, verificationError: { type: 'string' }, createdBy: { type: 'string' }, updatedBy: { type: 'string' }, revision: { type: 'integer' }, etag: { type: 'string' }, createdAt: timestamp, updatedAt: timestamp, certificationQueuedAt: timestamp, publishQueuedAt: timestamp, yankRequestedAt: timestamp,
        artifact: ref('ModelArtifact'), certification: ref('ModelCertificationRecord'), publication: ref('ModelPublicationRecord'), yank: ref('ModelYankRecord'),
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
        retiredAt: timestamp,
        retirementReason: { type: 'string' },
        retiredAllowed: { type: 'boolean' },
        retiredIsDefault: { type: 'boolean' },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    TeamModelPolicyRequest: {
      type: 'object',
      description: 'Legacy model-ID-wide policy revocation. allowed must be false and isDefault must be absent or false. Existing authentication, scope, ETag, and idempotency rules apply; these rows cannot be created or re-enabled.',
      required: ['allowed'],
      properties: {
        team: { type: 'string', description: 'May instead be supplied as the team query parameter.' },
        modelId: { type: 'string', description: 'May instead be supplied as the model query parameter.' },
        allowed: { const: false },
        isDefault: { enum: [false, null] },
      },
    },
    TeamModelReleaseGrant: {
      type: 'object',
      description: 'Team authorization for one immutable sha256 registry release. It does not transfer to replacement manifest bytes.',
      properties: {
        team: { type: 'string' },
        organizationSlug: { type: 'string' },
        releaseId: ref('ExactSHA256'),
        modelId: { type: 'string' },
        allowed: { type: 'boolean' },
        enabledUnderActivationId: ref('ExactSHA256'),
        authoritySnapshotSha256: ref('ExactSHA256'),
        revision: { type: 'integer' },
        etag: { type: 'string' },
        createdBy: { type: 'string' },
        updatedBy: { type: 'string' },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
    TeamModelReleaseGrantRequest: {
      type: 'object',
      required: ['allowed'],
      description: 'Creates or updates an exact-release grant. Enabling requires current serving authority for this release. Revocation remains available during authority outages.',
      properties: {
        team: { type: 'string', description: 'May instead be supplied as the team query parameter.' },
        releaseId: { ...ref('ExactSHA256'), description: 'Exact sha256 registry release identity; may instead be supplied as the release query parameter.' },
        allowed: { type: 'boolean' },
      },
    },
    ServingAuthorityView: {
      type: 'object',
      description: 'Non-secret operator inspection metadata. The API has no route for submitting or signing activation evidence.',
      properties: {
        releaseId: ref('ExactSHA256'),
        modelId: { type: 'string' },
        deploymentId: ref('ExactSHA256'),
        activationId: ref('ExactSHA256'),
        loadedIdentityId: ref('ExactSHA256'),
        routeId: { type: 'string' },
        instanceId: { type: 'string' },
        activationExpiresAt: timestamp,
        loadedIdentityExpiresAt: timestamp,
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
      description: 'Operator-provisioned scope. With both organizationSlug and team empty/omitted, the worker intentionally belongs to a global cross-organization operator pool.',
      required: ['kind', 'region', 'version', 'capabilities', 'capacity'],
      properties: {
        id: { type: 'string', description: 'Optional worker ID. An operator may replace an existing ID, rotating that worker credential.' },
        organizationSlug: { type: 'string', description: 'Must name an existing organization when used without team; when team is supplied, must match its derived organization.' },
        team: { type: 'string', description: 'Optional existing canonical team ID; its organization is resolved even when organizationSlug is supplied.' },
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
    WorkerRegistrationResult: {
      type: 'object',
      description: 'Provisioned worker and worker credential. Same-ID replacement rotates that credential; the operator-only boundary does not retroactively revoke other issued credentials. Provisioning does not attest execution, loaded weights, or certification.',
      properties: { worker: ref('Worker'), token: { type: 'string', description: 'Worker credential for heartbeat, lease, acknowledgement, and completion; not authorization to register workers.' } },
    },
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
    JobCompletion: {
      type: 'object',
      description: 'Worker-reported usage is retired and must be omitted. Cloud inference usage is written only by synchronous gateway reservation settlement.',
      properties: {
        state: { type: 'string', enum: ['succeeded', 'failed', 'canceled'] },
        payload: stringMap,
        usage: false,
      },
    },
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
        releaseId: ref('ExactSHA256'),
        activationId: ref('ExactSHA256'),
        loadedIdentityId: ref('ExactSHA256'),
        routeId: { type: 'string' },
        routeInstanceId: { type: 'string' },
        usageRequestId: { type: 'string' },
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
      description: 'Stored team configuration, not CLI drift enforcement or a signed per-job sandbox policy. The example shows defaults returned when no policy is stored; saves do not merge these read defaults except for empty sandboxProfiles and forced exceptionLogging.',
      examples: [{ team: '@s46/engineering', allowedFunctions: ['read', 'bash', 'edit', 'write'], mandatoryFunctions: [], sandboxProfiles: ['vm-default'], loopEnabled: false, exceptionLogging: true }],
      properties: {
        team: { type: 'string' },
        allowedFunctions: { type: 'array', items: { type: 'string' } },
        mandatoryFunctions: { type: 'array', items: { type: 'string' } },
        sandboxProfiles: { type: 'array', items: { type: 'string' }, description: 'An empty list is saved as ["vm-default"].' },
        loopEnabled: { type: 'boolean' },
        exceptionLogging: { type: 'boolean', description: 'Forced to true on save; does not itself implement an enforcement engine.' },
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
    OutputTokenLimit: {
      type: 'integer', minimum: 1, maximum: 2147483647,
      description: 'Must not exceed the effective catalog limit (maxOutputTokens bounded by contextWindow), when positive limits are available. Omitted limits default to that limit. Multiple supplied aliases must agree; invalid or excessive values return 400 invalid_request.',
    },
    OpenAIResponsesRequest: {
      type: 'object', additionalProperties: false, required: ['input'],
      description: 'Verified cloud subset: text, function tools/results, and text/JSON output. Send full history; unsupported features return 400 unsupported_feature. Cloud n_predict returns 400 invalid_request.',
      properties: {
        model: { type: 'string', description: 'Authorized public ID; omitted uses the configured team default.' },
        input: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'object', additionalProperties: true } }] },
        instructions: { type: ['string', 'null'] },
        stream: { type: 'boolean' },
        tools: { type: 'array', items: { type: 'object', required: ['type', 'name'], properties: { type: { const: 'function' }, name: { type: 'string' }, description: { type: 'string' }, parameters: { type: 'object' }, strict: { type: 'boolean' } }, additionalProperties: false } },
        tool_choice: { oneOf: [{ enum: ['auto', 'none', 'required'] }, { type: 'object', required: ['type', 'name'], properties: { type: { const: 'function' }, name: { type: 'string' } }, additionalProperties: false }] },
        parallel_tool_calls: { type: 'boolean' },
        temperature: { type: 'number' }, top_p: { type: 'number' },
        max_output_tokens: ref('OutputTokenLimit'), max_tokens: ref('OutputTokenLimit'), max_completion_tokens: ref('OutputTokenLimit'),
        store: { enum: [false, null] }, background: { enum: [false, null] },
        previous_response_id: { enum: ['', null] }, reasoning: { type: 'null' },
        metadata: { type: 'object', maxProperties: 0 },
        include: { type: 'array', maxItems: 0 }, truncation: { const: 'disabled' },
        text: { type: 'object', additionalProperties: false, properties: { format: { type: 'object', description: 'text, json_object, or json_schema output format', properties: { type: { enum: ['text', 'json_object', 'json_schema'] } } } } },
        client_metadata: { type: 'object', maxProperties: 16, additionalProperties: { type: 'string' }, description: 'Diagnostic-only, not forwarded: keys 1–64 bytes, values at most 512 bytes, aggregate at most 4096 bytes.' },
        prompt_cache_key: { type: 'string', description: 'At most 256 bytes; advisory only, not forwarded and no cache affinity promised.' },
      },
    },
    OpenAIChatCompletionRequest: {
      type: 'object', additionalProperties: true,
      description: 'Chat payload is dispatched only after exact serving authorization and worst-case usage reservation. Protected requests permit one output trajectory: n and best_of must be absent or exactly 1, and beam or multi-sample extensions are rejected. max_output_tokens and n_predict return 400 invalid_request.',
      properties: {
        model: { type: 'string', description: 'Authorized public ID; omitted uses the configured team default.' },
        messages: { type: 'array', items: { type: 'object', additionalProperties: true } },
        stream: { type: 'boolean' }, max_tokens: ref('OutputTokenLimit'), max_completion_tokens: ref('OutputTokenLimit'),
        n: { const: 1 }, best_of: { const: 1 },
        use_beam_search: false, beam_search: false, beam_search_options: false,
        beam_size: false, num_beams: false, beam_width: false,
        num_return_sequences: false, parallel_sampling: false, candidate_count: false,
        length_penalty: false, early_stopping: false,
        max_output_tokens: false, n_predict: false,
      },
    },
    AnthropicMessageRequest: {
      type: 'object', additionalProperties: false, required: ['messages'],
      description: 'Verified cloud text/function-tool subset. Attachments, thinking, server tools, and context management return 400 unsupported_feature. Output limits follow the catalog; max_tokens may be omitted.',
      properties: {
        model: { type: 'string', description: 'Authorized public ID; omitted uses the configured team default.' },
        messages: { type: 'array', minItems: 1, items: { type: 'object', properties: { role: { enum: ['user', 'assistant'] }, content: { description: 'Text or text/tool_use/tool_result blocks; tool results contain text only.' } } } },
        system: { description: 'Text or text blocks.' },
        max_tokens: ref('OutputTokenLimit'), stream: { type: 'boolean' },
        temperature: { type: 'number' }, top_p: { type: 'number' }, stop_sequences: { type: 'array', items: { type: 'string' } },
        tools: { type: 'array', items: { type: 'object', description: 'Named function tool with input_schema; server tool types are unsupported.' } },
        tool_choice: { type: 'object', description: 'type: auto, any, none, or tool (with name); optional disable_parallel_tool_use boolean.' },
        metadata: { type: 'object' },
      },
    },
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
