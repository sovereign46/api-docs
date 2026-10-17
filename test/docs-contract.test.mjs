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
  '/v1/admin/workers', '/v1/admin/workers/{id}', '/v1/admin/workers/{id}/logs',
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
  assert.deepEqual(schemas.ReadyResponse.properties.modelRegistry.enum, ['unavailable']);
  assert.deepEqual(schemas.ReadyResponse.examples, [
    { status: 'ok', database: 'ok' },
    { status: 'ok', database: 'disabled' },
    { status: 'unavailable', database: 'unavailable' },
    { status: 'unavailable', database: 'ok', modelRegistry: 'unavailable' },
    { status: 'unavailable', database: 'disabled', modelRegistry: 'unavailable' },
  ]);
});

test('runtime schemas and the team example preserve authorized metadata', () => {
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
  assert.equal(metadata.additionalProperties.$ref, '#/components/schemas/ModelRuntime');
  assert.equal(schemas.ModelCatalogEntry.properties.runtime.$ref, metadata.additionalProperties.$ref);
  assert.deepEqual(schemas.ModelCatalogEntry.properties.format.enum, ['gguf', 'safetensors']);
  for (const name of ['contextWindow', 'maxOutputTokens']) assert.equal(schemas.ModelCatalogEntry.properties[name].type, 'integer');
  assert.equal(schemas.OpenAIModelList.properties.data.items.properties.metadata.$ref, '#/components/schemas/ModelCatalogEntry');

  const team = JSON.parse(docs['teams-sessions.mdx'].match(/```json\n([\s\S]*?)\n```/)[1]);
  for (const field of Object.keys(team)) assert.ok(field in schemas.Team.properties, field);
  assert.ok(team.models.includes(team.defaultModel));
  assert.deepEqual(Object.keys(team.modelMetadata).sort(), team.models.toSorted());
  for (const runtime of Object.values(team.modelMetadata)) {
    for (const [field, value] of Object.entries(runtime)) {
      const type = schemas.ModelRuntime.properties[field]?.type;
      assert.ok(type, `undocumented runtime field ${field}`);
      assert.ok(type === 'integer' ? Number.isInteger(value) : typeof value === type, field);
    }
    assert.ok(runtime.maxTokens <= runtime.contextWindow);
    for (const required of schemas.ModelRuntime.required) assert.ok(required in runtime);
  }
});

test('admin settings and grant edits are distinguished from gated public discovery', () => {
  const settings = api.paths['/v1/admin/teams/{team}'].get;
  assert.match(settings.summary, /stored team settings/);
  assert.match(settings.description, /outages do not block settings reads/);
  assert.match(schemas.TeamModelPolicyRequest.description, /outages do not block edits/);
  assert.match(schemas.TeamModelPolicyRequest.description, /does not reopen model serving/);
  assert.match(schemas.Team.properties.models.description, /configured IDs/);
  assert.match(schemas.Team.properties.modelMetadata.description, /Only public cloud team resolution/);
  assert.match(api.paths['/v1/teams/{team}'].get.summary, /authorized cloud models/);
  assert.match(api.paths['/v1/teams/{team}'].get.responses['503'].description, /model_registry_unavailable/);
});

test('model discovery is public; verified model POST contracts include auth, SSE, and failures', () => {
  for (const path of modelLists) assert.equal(api.paths[path].get.security, undefined);
  for (const path of gatewayPosts) {
    const operation = api.paths[path].post;
    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    assert.deepEqual(Object.keys(operation.responses['200'].content).sort(), ['application/json', 'text/event-stream']);
    for (const status of ['400', '401', '403', '429', '502', '503']) {
      assert.equal(operation.responses[status].content['application/json'].schema.$ref, '#/components/schemas/ErrorResponse');
    }
    assert.match(operation.responses['400'].description, /unsupported_feature/);
    assert.match(operation.responses['502'].description, /upstream_error/);
    assert.match(operation.responses['503'].description, /model_registry_unavailable/);
  }
  for (const code of ['unsupported_feature', 'upstream_error', 'model_registry_unavailable']) {
    assert.ok(docs['errors.mdx'].includes(`\`${code}\``), code);
  }
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
  assert.equal(schemas.OpenAIChatCompletionRequest.properties.max_output_tokens, false);
  assert.equal(schemas.OpenAIChatCompletionRequest.properties.n_predict, false);
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
          if (scenario === 'registry-unavailable') return Response.json({ error: { code: 'model_registry_unavailable' } }, { status: 503 });
          return Response.json({ endpoint: 'https://example.invalid/gateway/', defaultModel: 'example/authorized-model', models: scenario === 'success' ? ['example/authorized-model'] : [] });
        }
        assert.equal(url, 'https://example.invalid/gateway/v1/chat/completions');
        assert.equal(init.method, 'POST');
        assert.equal(JSON.parse(init.body).model, 'example/authorized-model');
        return Response.json({ choices: [{ message: { content: 'ok' } }] });
      },
    });
    if (scenario === 'success') await program;
    else await assert.rejects(program, scenario === 'registry-unavailable' ? /503.*model_registry_unavailable/ : /authorized model/);
    assert.equal(calls.length, scenario === 'success' ? 3 : 2);
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
