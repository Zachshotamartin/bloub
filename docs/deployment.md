# Deployment

Kumo Logo Studio is deployed as a Vite SPA. GitHub Actions is the only deployment authority: Vercel's automatic Git deployments are disabled in `vercel.json`.

## Vercel project

1. Sign in to Vercel as `zachsm@alumni.stanford.edu`.
2. Run `pnpm exec vercel link` from this repository and link the `kumo-logo-studio` project.
3. Keep Framework Preset `Vite`, Build Command `pnpm build`, and Output Directory `dist`.
4. Connect `https://github.com/Zachshotamartin/bloub` for repository metadata, while leaving Git deployments disabled.

The SPA rewrite in `vercel.json` preserves direct links and browser refreshes.
The production alias is `https://kumo-logo-studio.vercel.app`.

## GitHub configuration

Create GitHub environments named `preview` and `production`. Add these secrets to both environments (or at repository level):

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | Access token created while signed in as `zachsm@alumni.stanford.edu` |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |

The workflow verifies the email attached to `VERCEL_TOKEN` before every deployment. Protect `main` so changes arrive through a current pull request with `Quality gates` and `Vercel preview` passing.

## Delivery flow

- Every pull request runs type-checking, the production build, and all unit tests.
- Same-repository pull requests deploy a Vercel preview and update `kumo-logo-preview-zach-9644.vercel.app`.
- A push to `main` after the quality gates deploys production.
- Fork pull requests never receive deployment secrets and do not deploy.

The deployment sequence matches Kumo: `vercel pull` → `vercel build` → `vercel deploy --prebuilt`.
