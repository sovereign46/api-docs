# s46-api-docs

Fumadocs/Next.js documentation for the Sovereign46 API contract.

## Development

```sh
npm install
npm run dev
npm run build
```

Open `http://localhost:3000/docs`. The OpenAPI document is served at `http://localhost:3000/openapi.json`.

The docs track the current source contract in `s46-api`, not proof of deployment. See [release status](content/docs/index.mdx), [serving authority](content/docs/serving-authority.mdx), and [model assurance status](content/docs/model-status.mdx) before treating source behavior, evidence, or a published release as live inference. Team IDs use canonical `@org/team` identifiers; production gateway examples use authenticated, exact-grant discovery and runtime limits.

## Contract checks

```sh
npm test
npm run lint
npm run build
```

Tests execute the OpenAPI GET handler in-process, validate generated schemas, production discovery security, exact-release grants, serving-authority inspection, readiness/error/media contracts and examples, and reject removed session-control APIs. They use the existing TypeScript dependency; no running API or database is needed. Update schema assertions alongside public contract changes. Deployment and loaded-model verification remain separate checks.

The production hostname is `docs.s46.dev`. The Dockerfile builds the Next app for the `docs` stack in `~/dev/s46-infra`.

## License

This repository is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
