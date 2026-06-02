import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const docsDir = new URL('content/docs/', root);
const docFiles = [
  'index.mdx',
  'operations.mdx',
  'auth.mdx',
  'account.mdx',
  'teams-sessions.mdx',
  'admin.mdx',
  'models.mdx',
  'worker-control.mdx',
  'gateway.mdx',
  'errors.mdx',
];

const [openapi, meta, ...docs] = await Promise.all([
  readFile(new URL('app/openapi.json/route.ts', root), 'utf8'),
  readFile(new URL('content/docs/meta.json', root), 'utf8'),
  ...docFiles.map((path) => readFile(new URL(path, docsDir), 'utf8')),
]);
const docsText = docs.join('\n\n');

function hasOpenApiPath(path) {
  return new RegExp(`^ {4}'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':`, 'm').test(openapi);
}

for (const page of [
  'operations',
  'auth',
  'account',
  'teams-sessions',
  'admin',
  'models',
  'worker-control',
  'gateway',
  'errors',
]) {
  assert.ok(meta.includes(`"${page}"`), `${page} missing from docs meta`);
}

const exposedPaths = [
  '/healthz',
  '/readyz',
  '/debug/vars',
  '/assets/auth.css',
  '/session',
  '/session/',
  '/device',
  '/v1/auth/device/start',
  '/v1/auth/login/start',
  '/v1/auth/device/poll',
  '/v1/auth/magic/consume',
  '/v1/auth/token/refresh',
  '/v1/auth/passkeys/register/start',
  '/v1/auth/passkeys/register/finish',
  '/v1/auth/passkeys/login/start',
  '/v1/auth/passkeys/login/finish',
  '/v1/auth/logout',
  '/v1/me',
  '/v1/devices',
  '/v1/devices/{deviceId}',
  '/v1/teams/{team}',
  '/v1/sessions',
  '/v1/sessions/{sessionId}/detach',
  '/v1/sessions/{sessionId}/resume',
  '/v1/sessions/{sessionId}/attach',
  '/v1/sessions/{sessionId}/stream',
  '/v1/sessions/{sessionId}/land',
  '/v1/admin/overview',
  '/v1/admin/organizations',
  '/v1/admin/organizations/{slug}',
  '/v1/admin/organization-members',
  '/v1/admin/organization-roles',
  '/v1/admin/people',
  '/v1/admin/invite',
  '/v1/admin/people/invite',
  '/v1/admin/invites',
  '/v1/admin/invite/revoke',
  '/v1/admin/people/{email}',
  '/v1/admin/people/{email}/teams',
  '/v1/admin/people/{email}/teams/{team}',
  '/v1/admin/people/{email}/devices/{deviceId}/revoke',
  '/v1/admin/people/{email}/invites/resend',
  '/v1/admin/people/{email}/audit',
  '/v1/admin/teams',
  '/v1/admin/teams/{team}',
  '/v1/admin/harness-policies',
  '/v1/admin/harness-policies/{team}',
  '/v1/admin/github/installations',
  '/v1/admin/repositories',
  '/v1/admin/models',
  '/v1/admin/model-policies',
  '/v1/admin/workers',
  '/v1/admin/workers/{id}',
  '/v1/admin/workers/{id}/logs',
  '/v1/admin/workers/{id}/drain',
  '/v1/admin/workers/{id}/revoke',
  '/v1/admin/jobs',
  '/v1/admin/jobs/{id}/logs',
  '/v1/admin/jobs/{id}/cancel',
  '/v1/admin/jobs/{id}/retry',
  '/v1/admin/schedules',
  '/v1/admin/usage',
  '/v1/admin/audit',
  '/v1/admin/leases/reconcile',
  '/v1/admin/seed',
  '/v1/worker/register',
  '/v1/worker/heartbeat',
  '/v1/worker/jobs/lease',
  '/v1/worker/jobs/complete',
  '/v1/internal/leases/ack',
  '/v1/workers',
  '/v1/workers/{id}',
  '/v1/models',
  '/v1/responses',
  '/v1/chat/completions',
  '/anthropic/v1/models',
  '/anthropic/v1/messages',
  '/codex/v1/models',
  '/codex/v1/responses',
];

for (const path of exposedPaths) {
  assert.ok(hasOpenApiPath(path), `${path} missing from OpenAPI paths`);
}

for (const route of exposedPaths.filter((path) => !['/v1/devices/{deviceId}'].includes(path))) {
  assert.ok(docsText.includes(route), `${route} missing from docs`);
}
assert.match(docsText, /DELETE` \| `\/v1\/devices\/\{deviceId\}`/);

for (const unsupported of [
  '/v1/admin/model-releases',
  '/v1/admin/model-releases/{releaseId}',
  '/v1/admin/model-releases/{releaseId}/upload-session',
  '/v1/admin/model-releases/{releaseId}/finalize-upload',
  '/v1/admin/model-releases/{releaseId}/validate',
  '/v1/admin/model-releases/{releaseId}/publish',
  '/v1/admin/model-releases/{releaseId}/yank',
]) {
  assert.ok(!hasOpenApiPath(unsupported), `${unsupported} should not be in OpenAPI until s46-api exposes it`);
}

assert.ok(!openapi.includes("post: adminWrite('Create model catalog entry'"), 'model catalog mutations are not exposed');
assert.ok(!openapi.includes("put: adminWrite('Update model catalog entry'"), 'model catalog mutations are not exposed');

for (const text of docs) {
  assert.doesNotMatch(text, /s46\/kimi-k2\.6/);
}
assert.match(docsText, /s46\/devstral-small-2-24b/);
assert.match(docsText, /Route groups/);
assert.match(docsText, /Build in this order/);
assert.match(docsText, /fails closed/);
assert.match(docsText, /team_model_policies/);
assert.match(docsText, /Idempotency-Key/);
assert.match(docsText, /model_not_allowed/);

const files = await readdir(docsDir);
assert.ok(!files.includes('cli.mdx'), 'old CLI-centered page should not remain');
assert.ok(!files.includes('workers.mdx'), 'old worker page should be renamed to route group');
