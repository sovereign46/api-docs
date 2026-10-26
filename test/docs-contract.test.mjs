import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const docsDir = new URL('content/docs/', root);
const docFiles = (await readdir(docsDir)).filter((name) => name.endsWith('.mdx'));
const docs = Object.fromEntries(await Promise.all(docFiles.map(async (name) => [
  name, (await readFile(new URL(name, docsDir), 'utf8')).replace(/\{\/\*[\s\S]*?\*\/\}/g, ''),
])));
const docsText = Object.values(docs).join('\n\n');
const { GET } = await loadTypeScript('app/openapi.json/route.ts');
const { routeIndex } = await loadTypeScript('lib/docs-routes.ts');
const response = GET();
const api = await response.json();
const schemas = api.components.schemas;
const gatewayPosts = ['/v1/chat/completions', '/v1/responses', '/codex/v1/responses', '/anthropic/v1/messages'];
const modelLists = ['/v1/models', '/codex/v1/models', '/anthropic/v1/models'];

// Explicit public inventory: removing an entry here is a contract change.
const exposedPaths = [
  '/healthz', '/readyz', '/debug/vars', '/assets/auth.css', '/device',
  '/v1/auth/device/start', '/v1/auth/login/start', '/v1/auth/device/poll',
  '/v1/auth/magic/consume', '/v1/auth/token/refresh', '/v1/auth/passkeys/register/start',
  '/v1/auth/passkeys/register/finish', '/v1/auth/passkeys/login/start',
  '/v1/auth/passkeys/login/finish', '/v1/auth/logout', '/v1/me', '/v1/devices',
  '/v1/devices/{deviceId}', '/v1/teams/{team}', '/v1/sessions',
  '/v1/admin/overview', '/v1/admin/organizations', '/v1/admin/organizations/{slug}',
  '/v1/admin/organization-members', '/v1/admin/organization-roles', '/v1/admin/people',
  '/v1/admin/invite', '/v1/admin/people/invite', '/v1/admin/invites', '/v1/admin/invite/revoke',
  '/v1/admin/people/{email}', '/v1/admin/people/{email}/teams',
  '/v1/admin/people/{email}/teams/{team}', '/v1/admin/people/{email}/devices/{deviceId}/revoke',
  '/v1/admin/people/{email}/invites/resend', '/v1/admin/people/{email}/audit',
  '/v1/admin/teams', '/v1/admin/teams/{team}', '/v1/admin/harness-policies',
  '/v1/admin/harness-policies/{team}', '/v1/admin/github/installations', '/v1/admin/repositories',
  '/v1/admin/model-releases', '/v1/admin/model-releases/{releaseId}',
  '/v1/admin/model-releases/{releaseId}/upload-session', '/v1/admin/model-releases/{releaseId}/finalize-upload',
  '/v1/admin/model-releases/{releaseId}/validate', '/v1/admin/model-releases/{releaseId}/publish',
  '/v1/admin/model-releases/{releaseId}/yank', '/v1/admin/models', '/v1/admin/model-policies',
  '/v1/admin/model-release-grants', '/v1/admin/serving-authority', '/v1/admin/workers', '/v1/admin/workers/{id}', '/v1/admin/workers/{id}/logs',
  '/v1/admin/workers/{id}/drain', '/v1/admin/workers/{id}/revoke',
  '/v1/admin/jobs', '/v1/admin/jobs/{id}/logs', '/v1/admin/jobs/{id}/cancel', '/v1/admin/jobs/{id}/retry',
  '/v1/admin/schedules', '/v1/admin/usage', '/v1/admin/audit', '/v1/admin/leases/reconcile', '/v1/admin/seed',
  '/v1/worker/register', '/v1/worker/heartbeat', '/v1/worker/jobs/lease', '/v1/worker/jobs/complete',
  '/v1/internal/leases/ack', '/v1/workers', '/v1/workers/{id}', ...modelLists, ...gatewayPosts,
];

test('GET emits a complete, internally linked OpenAPI document', () => {
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(api.openapi, '3.1.0');
  assert.equal(api.info.version, 'unreleased');
  assert.deepEqual(Object.keys(api.paths).sort(), exposedPaths.toSorted());
  const ids = new Set();
  for (const [path, methods] of Object.entries(api.paths)) {
    for (const operation of Object.values(methods)) {
      assert.ok(!ids.has(operation.operationId), `duplicate operationId: ${operation.operationId}`);
      ids.add(operation.operationId);
      for (const alternative of operation.security ?? []) {
        for (const scheme of Object.keys(alternative)) assert.ok(api.components.securitySchemes[scheme], `${path}: undefined security scheme ${scheme}`);
      }
      const pathParams = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      assert.deepEqual(
        (operation.parameters ?? []).filter((param) => param.in === 'path' && param.required).map((param) => param.name).sort(),
        pathParams.sort(), `${path}: missing required path parameter`,
      );
    }
  }
  walk(api, (value) => {
    if (!value.$ref) return;
    assert.match(value.$ref, /^#\/components\/schemas\//);
    assert.ok(schemas[value.$ref.split('/').at(-1)], `unresolved ref: ${value.$ref}`);
  });
});

test('navigation uses real methods/paths and edited pages have working anchors', async () => {
  const meta = JSON.parse(await readFile(new URL('meta.json', docsDir), 'utf8'));
  for (const page of docFiles.filter((name) => name !== 'index.mdx')) {
    assert.ok(meta.pages.includes(page.replace('.mdx', '')), `${page}: missing navigation`);
  }
  const pages = { operations: 'operations', teamsSessions: 'teams-sessions', models: 'models', gateway: 'gateway', workerControl: 'worker-control', admin: 'admin' };
  for (const [group, routes] of Object.entries(routeIndex)) {
    for (const route of routes) {
      if (route.path.startsWith('/')) {
        assert.ok(api.paths[route.path]?.[route.method.toLowerCase()], `${route.method} ${route.path}: nonexistent operation`);
      }
      if (pages[group]) {
        const headings = [...docs[`${pages[group]}.mdx`].matchAll(/^#{2,3} (.+)$/gm)]
          .map((match) => `#${match[1].toLowerCase().replace(/[^\w -]/g, '').replaceAll(' ', '-')}`);
        assert.ok(headings.includes(route.href), `${group}: missing anchor ${route.href}`);
      }
    }
  }
  assert.ok(!docFiles.includes('cli.mdx'));
  assert.ok(!docFiles.includes('workers.mdx'));
});

test('removed session-control routes and schemas cannot return unnoticed', () => {
  assert.deepEqual(Object.keys(api.paths['/v1/sessions']), ['get']);
  for (const path of Object.keys(api.paths)) {
    assert.ok(!path.startsWith('/session'), path);
    assert.ok(!path.startsWith('/v1/sessions/'), path);
  }
  for (const name of ['DetachRequest', 'ResumeRequest', 'AttachRequest', 'AttachResult', 'LandRequest', 'LandResult']) {
    assert.ok(!(name in schemas), name);
  }
  assert.ok(!('landGates' in schemas.HarnessPolicy.properties));
  assert.equal(/\/v1\/sessions\/[^\s]+\/(?:detach|resume|attach|stream|land)|(?:https?:\/\/[^/\s]+|[`"'])\/session(?:\/|[`"\s])/.test(docsText), false, 'removed session endpoint in public docs');
  assert.deepEqual(Object.keys(api.paths['/v1/admin/models']), ['get']);
});

test('worker registration requires operator provisioning credentials, not tenant or worker tokens', () => {
  const registration = api.paths['/v1/worker/register'].post;
  assert.deepEqual(registration.security, [{ operatorBearerAuth: [] }, { operatorAdminHeader: [] }]);
  const security = api.components.securitySchemes;
  assert.equal(security.operatorBearerAuth.type, 'http');
  assert.equal(security.operatorBearerAuth.scheme, 'bearer');
  assert.match(security.operatorBearerAuth.description, /S46_ADMIN_TOKEN/);
  assert.equal(security.operatorAdminHeader.type, 'apiKey');
  assert.equal(security.operatorAdminHeader.in, 'header');
  assert.equal(security.operatorAdminHeader.name, 'X-S46-Admin-Token');
  assert.match(security.operatorAdminHeader.description, /only when no bearer/);
  assert.equal(registration.responses['201'].content['application/json'].schema.$ref, '#/components/schemas/WorkerRegistrationResult');
  assert.equal(registration.responses['403'].content['application/json'].schema.$ref, '#/components/schemas/ErrorResponse');
  assert.match(registration.responses['403'].description, /tenant owner\/admin\/team-admin\/viewer and worker credentials/);
  assert.match(registration.responses['403'].description, /any scope or replace any worker ID/);
  assert.equal(registration.responses['401'], undefined, 'operator authorization rejects missing/wrong credentials with 403');
  assert.match(registration.description, /Non-production.*only when no operator token is configured/);
  assert.match(schemas.WorkerRegistrationResult.description, /Same-ID replacement rotates that credential/);
  assert.match(schemas.WorkerRegistrationResult.description, /does not retroactively revoke other issued credentials/);
  assert.match(schemas.WorkerRegistrationResult.properties.token.description, /not authorization to register/);
  assert.equal(routeIndex.workerControl[0].href, '#register');
  for (const path of ['/v1/worker/heartbeat', '/v1/worker/jobs/lease', '/v1/worker/jobs/complete']) {
    assert.deepEqual(api.paths[path].post.security, [{ bearerAuth: [] }], `${path}: lifecycle credentials must remain separate`);
  }
});

test('worker scopes and lifecycle capability checks are explicit without claiming execution attestation', () => {
  const registration = schemas.WorkerRegistration;
  for (const field of ['organizationSlug', 'team']) assert.ok(!registration.required.includes(field), `${field}: empty scope must remain an intentional operator pool`);
  assert.match(registration.description, /global cross-organization operator pool/);
  assert.match(registration.properties.organizationSlug.description, /existing organization/);
  assert.match(registration.properties.organizationSlug.description, /must match/);
  assert.match(registration.properties.team.description, /resolved even when organizationSlug is supplied/);
  const register = api.paths['/v1/worker/register'].post;
  assert.match(register.responses['400'].description, /conflicting organization\/team/);
  assert.match(register.responses['404'].description, /team or organization does not exist/);
  for (const [path, method] of [
    ['/v1/admin/workers/{id}', 'get'], ['/v1/admin/workers/{id}/logs', 'get'],
    ['/v1/admin/workers/{id}/drain', 'post'], ['/v1/admin/workers/{id}/revoke', 'post'],
  ]) {
    const operation = api.paths[path][method];
    assert.deepEqual(operation.security, [{ bearerAuth: [] }, { operatorBearerAuth: [] }, { operatorAdminHeader: [] }]);
    assert.match(operation.description, /stored worker team, else organization/);
    assert.match(operation.description, /Global workers.*require operator credentials/);
  }
  const lease = api.paths['/v1/worker/jobs/lease'].post;
  assert.match(lease.description, /current stored worker fields and credential under the lease lock/);
  assert.match(lease.description, /model_certification for model.certify/);
  assert.match(lease.description, /model_registry_publish for model.publish\/model.yank/);
  assert.match(lease.description, /regardless of advertised model IDs/);
  assert.match(lease.description, /do not attest workload execution/);
  assert.deepEqual(Object.keys(schemas.LeaseResult.properties).sort(), ['job', 'lease']);
});

test('harness policy documents stored defaults without removed action/enforcement promises', () => {
  assert.deepEqual(schemas.HarnessPolicy.examples, [{
    team: '@s46/engineering',
    allowedFunctions: ['read', 'bash', 'edit', 'write'],
    mandatoryFunctions: [],
    sandboxProfiles: ['vm-default'],
    loopEnabled: false,
    exceptionLogging: true,
  }]);
  assert.match(schemas.HarnessPolicy.description, /Stored team configuration/);
  assert.match(schemas.HarnessPolicy.properties.exceptionLogging.description, /Forced to true on save/);
  assert.equal(/s46\.land_pr|review_gate|landGates/.test(docsText), false, 'removed harness actions in public docs');
});

test('readiness 503 is a status response, not the API error envelope', () => {
  const ready = api.paths['/readyz'].get;
  assert.equal(ready.security, undefined);
  for (const status of ['200', '503']) {
    assert.equal(ready.responses[status].content['application/json'].schema.$ref, '#/components/schemas/ReadyResponse');
  }
  assert.deepEqual(schemas.ReadyResponse.required, ['status', 'database']);
  assert.deepEqual(schemas.ReadyResponse.properties.modelRegistry.enum, ['ok', 'unavailable']);
  assert.deepEqual(schemas.ReadyResponse.properties.servingAuthority.enum, ['ok', 'unavailable']);
  assert.deepEqual(schemas.ReadyResponse.examples, [
    { status: 'ok', database: 'ok', modelRegistry: 'ok', servingAuthority: 'ok' },
    { status: 'ok', database: 'disabled', modelRegistry: 'ok', servingAuthority: 'ok' },
    { status: 'unavailable', database: 'unavailable' },
    { status: 'unavailable', database: 'ok', modelRegistry: 'unavailable', servingAuthority: 'unavailable' },
    { status: 'unavailable', database: 'disabled', modelRegistry: 'unavailable', servingAuthority: 'unavailable' },
    { status: 'unavailable', database: 'ok', modelRegistry: 'ok', servingAuthority: 'unavailable' },
  ]);
});

test('runtime schemas distinguish gateway authority from team compatibility metadata', () => {
  assert.deepEqual(Object.keys(schemas.ModelRuntime.properties).sort(), [
    'engine', 'version', 'profileSha256', 'contextWindow', 'maxTokens', 'reasoning', 'minMemoryBytes', 'recommendedMemoryBytes',
  ].sort());
  assert.deepEqual(schemas.ModelRuntime.required, ['reasoning']);
  assert.equal(schemas.ModelRuntime.properties.reasoning.type, 'boolean');
  const metadata = schemas.Team.properties.modelMetadata;
  assert.deepEqual(metadata.type, ['object', 'null']);
  assert.equal(metadata.readOnly, undefined, 'shared settings schema must not promise all metadata is computed');
  assert.ok(!(schemas.Team.required ?? []).includes('modelMetadata'), 'settings writes must not require discovery metadata');
  assert.deepEqual(schemas.Team.properties.models.type, ['array', 'null']);
  assert.match(schemas.Team.description, /compatibility fields, not exact serving-authority discovery/);
  assert.match(schemas.Team.description, /authenticated gateway GET \/v1\/models/);
  assert.match(schemas.Team.properties.models.description, /Compatibility model IDs/);
  assert.match(metadata.description, /Compatibility runtime metadata/);
  assert.equal(metadata.additionalProperties.$ref, '#/components/schemas/ModelRuntime');
  assert.equal(schemas.ModelCatalogEntry.properties.runtime.$ref, metadata.additionalProperties.$ref);
  assert.deepEqual(schemas.ModelCatalogEntry.properties.format.enum, ['gguf', 'safetensors']);
  for (const name of ['contextWindow', 'maxOutputTokens']) assert.equal(schemas.ModelCatalogEntry.properties[name].type, 'integer');
  assert.equal(schemas.OpenAIModelList.properties.data.items.properties.metadata.$ref, '#/components/schemas/ModelCatalogEntry');

  const team = JSON.parse(docs['teams-sessions.mdx'].match(/```json\n([\s\S]*?)\n```/)[1]);
  for (const field of Object.keys(team)) assert.ok(field in schemas.Team.properties, field);
  assert.deepEqual(team.models, []);
  assert.deepEqual(team.modelMetadata, {});
  assert.ok(!team.models.includes(team.defaultModel));
  assert.match(docs['teams-sessions.mdx'], /compatibility fields/);
  assert.match(docs['teams-sessions.mdx'], /Authenticated gateway model discovery is the authoritative production path/);
  const publicTeamContract = `${docs['teams-sessions.mdx']}\n${JSON.stringify(schemas.Team)}`;
  for (const implementationDetail of ['TeamServingCatalog', 'until the API source is corrected', 'retired legacy model-ID policies']) {
    assert.ok(!publicTeamContract.includes(implementationDetail), implementationDetail);
  }
});

test('admin settings, retired policies, and exact grants remain distinct from serving authorization', () => {
  const settings = api.paths['/v1/admin/teams/{team}'].get;
  assert.match(settings.summary, /stored team settings/);
  assert.match(settings.description, /outages do not block settings reads/);
  assert.match(schemas.TeamModelPolicyRequest.description, /revocation/);
  assert.equal(schemas.TeamModelPolicyRequest.properties.allowed.const, false);
  assert.deepEqual(schemas.TeamModelPolicyRequest.properties.isDefault.enum, [false, null]);
  for (const method of ['put', 'patch']) {
    const operation = api.paths['/v1/admin/model-policies'][method];
    const headers = Object.fromEntries(operation.parameters.filter((parameter) => parameter.in === 'header').map((parameter) => [parameter.name, parameter]));
    assert.equal(headers['Idempotency-Key'].required, true);
    assert.equal(headers['If-Match'].required, true);
  }
  assert.match(schemas.Team.properties.models.description, /not authoritative exact serving-authority discovery/);
  assert.match(schemas.Team.properties.modelMetadata.description, /not authoritative exact serving-authority discovery/);
  assert.match(api.paths['/v1/teams/{team}'].get.summary, /settings and compatibility metadata/);
  assert.match(api.paths['/v1/teams/{team}'].get.responses['503'].description, /model_registry_unavailable/);
  assert.doesNotMatch(api.paths['/v1/teams/{team}'].get.responses['503'].description, /serving_authority_unavailable/);
});

test('exact release identities and conditional grants are explicit', () => {
  assert.match(schemas.ModelReleaseIdentity.description, /sha256 release ID.*rel_/);
  assert.equal(schemas.ModelReleaseIdentity.properties.runtime.$ref, '#/components/schemas/ModelRuntime');
  for (const field of ['manifestSha256', 'manifestSignatureSha256', 'artifactSha256', 'runtimeIdentitySha256']) {
    assert.equal(schemas.ModelReleaseIdentity.properties[field].type, 'string', field);
  }
  assert.match(schemas.ModelCatalogEntry.properties.releaseId.description, /sha256 identity/);
  assert.deepEqual(schemas.ModelCatalogResponse.required, ['models', 'modelReleaseIdentities']);
  assert.equal(schemas.ModelCatalogResponse.properties.modelReleaseGrants.items.$ref, '#/components/schemas/TeamModelReleaseGrant');
  assert.equal(schemas.ModelCatalogResponse.properties.modelReleaseIdentities.maxItems, 1000);
  const modelParams = api.paths['/v1/admin/models'].get.parameters.map((parameter) => parameter.name);
  assert.ok(modelParams.includes('model'));

  const grantPath = api.paths['/v1/admin/model-release-grants'];
  assert.deepEqual(Object.keys(grantPath).sort(), ['get', 'patch', 'put']);
  assert.equal(schemas.TeamModelReleaseGrantRequest.properties.releaseId.type, 'string');
  assert.match(schemas.TeamModelReleaseGrantRequest.description, /Revocation remains available/);
  for (const method of ['put', 'patch']) {
    const headers = Object.fromEntries(grantPath[method].parameters.filter((parameter) => parameter.in === 'header').map((parameter) => [parameter.name, parameter]));
    assert.equal(headers['Idempotency-Key'].required, true);
    assert.equal(headers['If-Match'].required, false);
    assert.match(headers['If-Match'].description, /Required for an existing grant; omit when creating/);
  }
  assert.match(docs['models.mdx'], /omit `If-Match` when creating/);
  assert.match(docs['models.mdx'], /send the current grant ETag/);
});

test('serving authority inspection is operator-only, read-only, and non-secret', () => {
  const authority = api.paths['/v1/admin/serving-authority'];
  assert.deepEqual(Object.keys(authority), ['get']);
  assert.deepEqual(authority.get.security, [{ operatorBearerAuth: [] }, { operatorAdminHeader: [] }]);
  assert.equal(authority.get.responses['200'].content['application/json'].schema.properties.data.items.$ref, '#/components/schemas/ServingAuthorityView');
  assert.deepEqual(Object.keys(schemas.ServingAuthorityView.properties).sort(), [
    'releaseId', 'modelId', 'deploymentId', 'activationId', 'loadedIdentityId', 'routeId', 'instanceId', 'activationExpiresAt', 'loadedIdentityExpiresAt',
  ].sort());
  assert.match(schemas.ServingAuthorityView.description, /no route for submitting or signing activation evidence/);
  assert.match(docs['serving-authority.mdx'], /not evidence that production has provisioned/);
});

test('production model discovery and verified model POST contracts include auth, SSE, and failures', () => {
  for (const path of modelLists) assert.deepEqual(api.paths[path].get.security, [{ bearerAuth: [] }]);
  for (const path of gatewayPosts) {
    const operation = api.paths[path].post;
    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    assert.deepEqual(Object.keys(operation.responses['200'].content).sort(), ['application/json', 'text/event-stream']);
    for (const status of ['400', '401', '403', '429', '502', '503']) {
      assert.equal(operation.responses[status].content['application/json'].schema.$ref, '#/components/schemas/ErrorResponse');
    }
    assert.match(operation.responses['400'].description, /unsupported_feature/);
    assert.match(operation.responses['429'].description, /monthly_cap_exceeded.*before upstream dispatch/);
    assert.match(operation.responses['502'].description, /upstream_error/);
    assert.match(operation.responses['503'].description, /model_registry_unavailable/);
    assert.match(operation.responses['503'].description, /serving_authority_unavailable/);
  }
  for (const code of ['unsupported_feature', 'upstream_error', 'model_registry_unavailable', 'serving_authority_unavailable', 'monthly_cap_exceeded']) {
    assert.ok(docs['errors.mdx'].includes(`\`${code}\``), code);
  }
  assert.ok(!docsText.includes('capacity_limited'));
  assert.doesNotMatch(api.paths['/v1/me'].get.responses['429'].description, /capacity_limited/);
});

test('model assurance docs keep identity, release, activation, and inference separate', () => {
  const status = docs['model-status.mdx'];
  for (const phrase of [
    'Artifact identity',
    'Runtime certification',
    'Release approval',
    'Registry publication',
    'Deployment / activation / loaded identity',
    'Production inference',
    'Not runtime certified',
    'Unavailable and unauthorized',
    'TinyStories documents lack previous-policy proofs',
    'synchronous monthly-cap accounting',
    'backend alias differs',
  ]) assert.ok(status.includes(phrase), phrase);
  for (const examplePage of ['gateway.mdx', 'teams-sessions.mdx']) {
    assert.ok(!/deepseek-v4-flash-0731/i.test(docs[examplePage]), `${examplePage}: candidate used as a serving example`);
  }
  assert.match(schemas.ModelCatalogEntry.properties.certified.description, /not an attestation of currently loaded runtime bytes/);
  assert.match(schemas.ModelCatalogEntry.properties.published.description, /does not imply activation or serving availability/);
  assert.match(schemas.ModelCatalogEntry.properties.sigsumStatus.description, /not a permanent live-health or activation badge/);
});

test('cloud request schemas describe supported limits and reject stateful/unsupported features', () => {
  assert.equal(schemas.OutputTokenLimit.minimum, 1);
  assert.equal(schemas.OutputTokenLimit.maximum, 2147483647);
  const limits = {
    OpenAIChatCompletionRequest: ['max_tokens', 'max_completion_tokens'],
    OpenAIResponsesRequest: ['max_output_tokens', 'max_tokens', 'max_completion_tokens'],
    AnthropicMessageRequest: ['max_tokens'],
  };
  for (const [name, fields] of Object.entries(limits)) {
    for (const field of fields) assert.equal(schemas[name].properties[field].$ref, '#/components/schemas/OutputTokenLimit');
    assert.ok(!(schemas[name].required ?? []).includes('model'), `${name}: model may be omitted`);
  }
  const responses = schemas.OpenAIResponsesRequest;
  assert.equal(responses.additionalProperties, false);
  assert.deepEqual(responses.properties.store.enum, [false, null]);
  assert.deepEqual(responses.properties.background.enum, [false, null]);
  assert.deepEqual(responses.properties.previous_response_id.enum, ['', null]);
  assert.equal(responses.properties.reasoning.type, 'null');
  assert.equal(responses.properties.tools.items.properties.type.const, 'function');
  assert.equal(schemas.AnthropicMessageRequest.additionalProperties, false);
  const chat = schemas.OpenAIChatCompletionRequest;
  assert.equal(chat.properties.max_output_tokens, false);
  assert.equal(chat.properties.n_predict, false);
  assert.equal(chat.properties.n.const, 1);
  assert.equal(chat.properties.best_of.const, 1);
  assert.match(chat.description, /one output trajectory/);
});

test('usage schemas bind settlement to exact serving authority and retire worker accounting', () => {
  for (const field of ['releaseId', 'activationId', 'loadedIdentityId', 'routeId', 'routeInstanceId', 'usageRequestId']) {
    assert.equal(schemas.UsageEvent.properties[field].type, 'string', field);
  }
  const workerUsage = schemas.JobCompletion.properties.usage;
  assert.equal(workerUsage.$ref, '#/components/schemas/UsageEvent');
  assert.equal(workerUsage.deprecated, true);
  assert.match(workerUsage.description, /synchronous gateway reservation settlement/);
  assert.match(docs['gateway.mdx'], /settles durably before emitting its success terminal/);
  assert.match(docs['serving-authority.mdx'], /response\.incomplete.*after settlement/);
  assert.match(docs['worker-control.mdx'], /completion\.usage.*retired/);
});

test('quickstart executes discovery-driven calls and stops on unauthorized defaults/errors', async () => {
  const code = docs['quickstart.mdx'].match(/```js\n([\s\S]*?)\n```/)[1];
  for (const scenario of ['success', 'unavailable-default', 'registry-unavailable']) {
    const calls = [];
    const program = runInNewContext(`(async () => { ${code} })()`, {
      process: { env: { S46_ACCESS_TOKEN: 'test-only-token' } },
      console: { log() {} },
      fetch: async (url, init) => {
        calls.push({ url, init });
        assert.equal(init.headers.Authorization, 'Bearer test-only-token');
        if (calls.length === 1) {
          assert.equal(url, 'https://api.s46.dev/v1/me');
          return Response.json({ team: '@example/engineering' });
        }
        if (calls.length === 2) {
          assert.equal(url, 'https://api.s46.dev/v1/teams/%40example%2Fengineering');
          return Response.json({ endpoint: 'https://example.invalid/gateway/', defaultModel: 'example/authorized-model', models: ['legacy-only-model'] });
        }
        if (calls.length === 3) {
          assert.equal(url, 'https://example.invalid/gateway/v1/models');
          assert.equal(init.method, 'GET');
          if (scenario === 'registry-unavailable') return Response.json({ error: { code: 'model_registry_unavailable' } }, { status: 503 });
          return Response.json({ object: 'list', data: scenario === 'success' ? [{ id: 'example/authorized-model', metadata: { releaseId: 'sha256:test' } }] : [] });
        }
        assert.equal(url, 'https://example.invalid/gateway/v1/chat/completions');
        assert.equal(init.method, 'POST');
        assert.equal(JSON.parse(init.body).model, 'example/authorized-model');
        return Response.json({ choices: [{ message: { content: 'ok' } }] });
      },
    });
    if (scenario === 'success') await program;
    else await assert.rejects(program, scenario === 'registry-unavailable' ? /503.*model_registry_unavailable/ : /authorized model/);
    assert.equal(calls.length, scenario === 'success' ? 4 : 3);
  }
});

async function loadTypeScript(path) {
  const source = await readFile(new URL(path, root), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}
