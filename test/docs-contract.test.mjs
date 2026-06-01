import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [openapi, auth, admin, cli, workers, models] = await Promise.all([
  'app/openapi.json/route.ts',
  'content/docs/auth.mdx',
  'content/docs/admin.mdx',
  'content/docs/cli.mdx',
  'content/docs/workers.mdx',
  'content/docs/models.mdx',
].map((path) => readFile(new URL(path, root), 'utf8')));
const docs = [admin, cli, workers, models];

function openApiPathKey(path) {
  return `    '${path}': {`;
}

for (const path of [
  '/v1/auth/passkeys/register/start',
  '/v1/auth/passkeys/register/finish',
  '/v1/auth/passkeys/login/start',
  '/v1/auth/passkeys/login/finish',
]) {
  assert.ok(openapi.includes(openApiPathKey(path)), `${path} missing from OpenAPI paths`);
  assert.ok(auth.includes(path), `${path} missing from auth docs`);
}

for (const path of [
  '/v1/admin/model-releases',
  '/v1/admin/model-releases/{releaseId}',
  '/v1/admin/model-releases/{releaseId}/upload-session',
  '/v1/admin/model-releases/{releaseId}/finalize-upload',
  '/v1/admin/model-releases/{releaseId}/validate',
  '/v1/admin/model-releases/{releaseId}/publish',
  '/v1/admin/model-releases/{releaseId}/yank',
]) {
  assert.ok(openapi.includes(openApiPathKey(path)), `${path} missing from OpenAPI paths`);
}

for (const text of docs) {
  assert.match(text, /s46\/devstral-small-2-24b/);
  assert.doesNotMatch(text, /s46\/kimi-k2\.6/);
}

const checklistRequirements = [
  /Routine org key enrollment, rotation, and revocation never require an offline-root ceremony/,
  /online org-provenance delegation key/,
  /content-addressed CAS object by digest, verifies the object hash before model load, and fails closed on mismatch/,
  /Legacy releases are not grandfathered/,
  /re-verify legacy models on S46-controlled certification workers/,
  /legacy-uncertified/,
  /API atomically marks the release `yanking` and sets an internal resolver block flag/,
  /state remains `yanking`, serving remains halted, and the job retries/,
  /per-org submission rate/,
  /bounded queue is full, new validation requests are rejected/,
  /certification cost ceiling/,
  /independent witness quorum/,
  /Client witness policy is pinned in the signed root/,
  /There is no path where an org-held key vouches for verification/,
];

for (const required of checklistRequirements) {
  assert.match(models, required);
}

for (const contradiction of [
  /org-held key (may|can|must) vouch(?:es)? for verification/i,
  /Org enrollment grants certification authority/i,
  /trust-root:update.*operator scope/i,
  /backendModel.*client-supplied/i,
  /legacy releases are grandfathered/i,
  /serving resumes.*Sigsum/i,
  /unbounded.*certification queue/i,
]) {
  assert.doesNotMatch(models, contradiction);
}
