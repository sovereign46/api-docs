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
- Model assurance status: ${SITE_URL}/docs/model-status

Contract constraints:
- Use canonical \`@org/team\` team identifiers.
- Use \`region\` terminology; legacy \`lane\` does not appear in new payloads.
- Tenant wildcard hosts are not part of the API contract.
- User-facing clients use user-scoped bearer tokens from the invite-gated device flow.
- Select models from authorized team metadata; a configured default may not be currently allowed.
- Keep artifact identity, runtime certification, release approval, publication, activation, and live inference separate.
- Verification-enabled model serving requires independent current registry trust, including in development.

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
