import { llms } from 'fumadocs-core/source/llms';

import { source } from '@/lib/source';

const SITE_URL = 'https://docs.s46.dev';

export function buildLlmsText() {
  const pages = absolutizeLinks(llms(source).index())
    .replace(/^# .+?\n+/, '')
    .trim();

  return `# Sovereign46 API docs

> Current source API reference. Check [release status](https://docs.s46.dev/docs#release-status) for pending behavior; these docs do not verify deployment.

Canonical URLs:
- Docs: ${SITE_URL}/docs
- OpenAPI: ${SITE_URL}/openapi.json
- API: https://api.s46.dev
- Harness gateway: https://gateway.s46.dev
- Serving authority: ${SITE_URL}/docs/serving-authority
- Model assurance status: ${SITE_URL}/docs/model-status

Contract constraints:
- Use canonical \`@org/team\` team identifiers.
- Use \`region\` terminology; legacy \`lane\` does not appear in new payloads.
- Tenant wildcard hosts are not part of the API contract.
- User-facing clients use user-scoped bearer tokens from the invite-gated device flow.
- Production discovery is authenticated gateway \`GET /v1/models\` (or its protocol equivalent) and returns only the caller team's active exact-granted releases.
- Team \`models\` and \`modelMetadata\` are compatibility fields, not exact serving-authority discovery; do not authorize from them.
- Keep mutable \`rel_...\` release-workflow IDs distinct from immutable \`sha256:...\` registry release identities.
- Keep artifact identity, runtime certification, release approval, publication, deployment, activation, loaded identity, exact grant, accounting, and live inference separate.
- Production serving requires current registry trust, signed serving authority, protected routing, an exact-release grant, and successful usage reservation.
- A stream succeeds only after durable usage settlement and its protocol success terminal.
- Source behavior and production URLs do not prove that production keys, evidence, routes, grants, or deployment authority exist.

## Documentation pages

${pages}
`;
}

export function llmsResponse() {
  return new Response(buildLlmsText(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function absolutizeLinks(markdown: string) {
  return markdown.replace(/\]\((\/[^)]+)\)/g, `](${SITE_URL}$1)`);
}
