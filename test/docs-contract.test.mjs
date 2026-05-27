import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const openapi = await readFile(new URL('app/openapi.json/route.ts', root), 'utf8');
const auth = await readFile(new URL('content/docs/auth.mdx', root), 'utf8');
const docs = await Promise.all(['content/docs/admin.mdx', 'content/docs/cli.mdx', 'content/docs/workers.mdx'].map((path) => readFile(new URL(path, root), 'utf8')));

for (const path of [
  '/v1/auth/passkeys/register/start',
  '/v1/auth/passkeys/register/finish',
  '/v1/auth/passkeys/login/start',
  '/v1/auth/passkeys/login/finish',
]) {
  assert.match(openapi, new RegExp(path.replaceAll('/', '\\/')));
  assert.match(auth, new RegExp(path.replaceAll('/', '\\/')));
}

for (const text of docs) {
  assert.match(text, /s46\/devstral-small-2-24b/);
  assert.doesNotMatch(text, /s46\/kimi-k2\.6/);
}
