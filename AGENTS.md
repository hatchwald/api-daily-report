# AGENTS.md

## Project Overview

This project is a developer activity reporting application.

Users connect one or more Git providers such as:

- GitHub
- GitLab.com
- Self-hosted GitLab

The application reads authorized Git activity and generates a daily development report when the user manually clicks **Generate Report**.

The MVP is backend-first.

Do **not** add scheduled jobs, cron jobs, Redis, BullMQ, or background workers unless explicitly requested later.

---

# 1. Main Product Flow

The expected application flow is:

1. User registers or signs in.
2. User connects a Git provider.
3. The application stores the authorized connection securely.
4. User selects which repositories should be included.
5. User selects a report date.
6. User clicks **Generate Report**.
7. Backend fetches activities from the selected Git providers.
8. Backend normalizes provider-specific activity into a common internal format.
9. Backend groups related activity.
10. Backend generates a daily report.
11. Backend stores the generated report.
12. Frontend displays the report.
13. User may regenerate the report later.

The initial implementation is manual generation only.

---

# 2. Initial Tech Stack

## Backend

Use:

- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Prisma ORM
- Zod
- Vitest
- ESLint
- Prettier
- Swagger / OpenAPI using Fastify Swagger plugins

Recommended packages:

```bash
fastify
@fastify/cors
@fastify/helmet
@fastify/rate-limit
@fastify/swagger
@fastify/swagger-ui
@fastify/cookie
@fastify/session
zod
prisma
@prisma/client
vitest
eslint
prettier
typescript
tsx
```

Use maintained packages and verify current package compatibility before installing.

---

# 3. Backend-First Development Rule

Backend functionality must be implemented and verified before frontend integration.

Development order:

```text
Database
   ↓
Domain / Service Layer
   ↓
Provider Integration
   ↓
API Route
   ↓
Validation
   ↓
Unit / Integration Test
   ↓
Swagger Documentation
   ↓
Frontend Integration
```

Do not build frontend behavior against unfinished or undocumented API contracts.

---

# 4. Architecture

Use a modular monolith.

Do not create microservices for the MVP.

Recommended structure:

```text
apps/
└── api/
    └── src/
        ├── app.ts
        ├── server.ts
        │
        ├── config/
        │   ├── env.ts
        │   └── constants.ts
        │
        ├── plugins/
        │   ├── auth.ts
        │   ├── cors.ts
        │   ├── database.ts
        │   ├── rate-limit.ts
        │   ├── security.ts
        │   └── swagger.ts
        │
        ├── modules/
        │   ├── auth/
        │   │   ├── auth.controller.ts
        │   │   ├── auth.route.ts
        │   │   ├── auth.schema.ts
        │   │   ├── auth.service.ts
        │   │   └── auth.test.ts
        │   │
        │   ├── connections/
        │   │   ├── connection.controller.ts
        │   │   ├── connection.route.ts
        │   │   ├── connection.schema.ts
        │   │   ├── connection.service.ts
        │   │   └── connection.test.ts
        │   │
        │   ├── repositories/
        │   │   ├── repository.controller.ts
        │   │   ├── repository.route.ts
        │   │   ├── repository.schema.ts
        │   │   ├── repository.service.ts
        │   │   └── repository.test.ts
        │   │
        │   └── reports/
        │       ├── report.controller.ts
        │       ├── report.route.ts
        │       ├── report.schema.ts
        │       ├── report.service.ts
        │       ├── report.mapper.ts
        │       └── report.test.ts
        │
        ├── providers/
        │   ├── git-provider.interface.ts
        │   │
        │   ├── github/
        │   │   ├── github.provider.ts
        │   │   ├── github.auth.ts
        │   │   ├── github.mapper.ts
        │   │   └── github.test.ts
        │   │
        │   └── gitlab/
        │       ├── gitlab.provider.ts
        │       ├── gitlab.auth.ts
        │       ├── gitlab.mapper.ts
        │       └── gitlab.test.ts
        │
        ├── shared/
        │   ├── errors/
        │   ├── types/
        │   ├── utils/
        │   └── validation/
        │
        └── tests/
            ├── helpers/
            └── fixtures/
```

Avoid unnecessary abstraction.

Create abstractions only when they remove real duplication or enforce a meaningful contract.

---

# 5. Git Provider Architecture

All Git providers must implement one shared interface.

Example:

```ts
export interface GitProvider {
  getCurrentUser(): Promise<GitUser>;

  getRepositories(): Promise<GitRepository[]>;

  getCommits(input: ActivityQuery): Promise<GitCommit[]>;

  getMergeRequests(input: ActivityQuery): Promise<GitMergeRequest[]>;

  getReviews(input: ActivityQuery): Promise<GitReview[]>;
}
```

Provider-specific API responses must never leak directly into the report domain.

Always normalize external responses first.

Example normalized commit:

```ts
export interface GitCommit {
  provider: 'github' | 'gitlab';
  repositoryId: string;
  repositoryName: string;
  externalId: string;
  sha: string;
  title: string;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: Date;
  url: string | null;
}
```

---

# 6. GitHub Connection Rule

Prefer a GitHub App for repository authorization.

Users should not normally be required to manually create Personal Access Tokens.

The application should request the minimum read-only permissions necessary.

Never request write permissions unless a future feature explicitly requires them.

Store identifiers such as:

- installation ID
- provider account ID
- username
- authorized repository IDs

Do not expose provider secrets to the frontend.

---

# 7. GitLab Connection Rule

Use OAuth 2.0 for:

- GitLab.com
- Self-hosted GitLab

A GitLab connection must store a configurable `baseUrl`.

Examples:

```text
https://gitlab.com
https://git.company.example
```

Do not duplicate the GitLab provider implementation only because the base URL changes.

Self-hosted GitLab instances may require administrator configuration before OAuth can be used.

The application must fail gracefully when OAuth is unavailable.

---

# 8. Read-Only Principle

This application is a reporting tool.

Git provider integration must remain read-only.

The backend must not:

- push commits
- modify branches
- create commits
- delete repositories
- merge pull requests
- merge merge requests
- modify issues
- modify repository settings

If a future feature requires write access, it must be treated as a separate feature and explicitly reviewed.

---

# 9. Data Privacy Rule

For the MVP, avoid storing source code.

Prefer retrieving and storing only information required for reporting, such as:

- repository identifier
- repository name
- commit SHA
- commit message
- commit author
- commit timestamp
- pull request title
- merge request title
- review activity
- source URL

Do not permanently store file contents or full source code unless explicitly required later.

Never log:

- OAuth access tokens
- refresh tokens
- GitHub private keys
- authorization codes
- session secrets
- cookies
- database credentials

---

# 10. Environment Variables

All secrets and environment-specific configuration must come from environment variables.

Example:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=

SESSION_SECRET=

FRONTEND_URL=http://localhost:5173

GITHUB_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=

GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_REDIRECT_URI=
```

Environment variables must be validated at application startup.

Do not allow the application to start when required production configuration is missing.

Use Zod or an equivalent schema for environment validation.

---

# 11. Database Rules

Use PostgreSQL with Prisma.

Initial entities should include:

```text
User

GitConnection

Repository

Report

ReportItem
```

Possible structure:

```text
users
────────────────────────
id
email
password_hash
name
created_at
updated_at
```

```text
git_connections
────────────────────────
id
user_id
provider
provider_type
base_url
provider_user_id
provider_username
auth_type
access_token_encrypted
refresh_token_encrypted
token_expires_at
installation_id
status
created_at
updated_at
```

```text
repositories
────────────────────────
id
connection_id
external_id
name
full_name
url
enabled
created_at
updated_at
```

```text
reports
────────────────────────
id
user_id
report_date
summary
total_commits
total_merge_requests
total_reviews
generated_at
created_at
updated_at
```

```text
report_items
────────────────────────
id
report_id
provider
repository_name
category
title
description
activity_count
source_data
created_at
updated_at
```

Use JSON only when the stored structure genuinely varies.

Do not use JSON as a replacement for proper relational modeling.

---

# 12. Manual Report Generation

The MVP must not run reports automatically.

The report endpoint is explicitly triggered by the user.

Example:

```http
POST /api/v1/reports/generate
```

Request:

```json
{
  "date": "2026-08-17",
  "connectionIds": [
    "connection-1",
    "connection-2"
  ]
}
```

Expected flow:

```text
Validate request
      ↓
Validate authenticated user
      ↓
Check ownership of requested connections
      ↓
Calculate selected date range in user's timezone
      ↓
Load enabled repositories
      ↓
Fetch provider activity
      ↓
Normalize activity
      ↓
Deduplicate activity
      ↓
Group related activity
      ↓
Generate report
      ↓
Save report
      ↓
Return report
```

A user must never be able to generate a report using another user's Git connection.

---

# 13. Regenerate Behavior

A report may be regenerated for the same user and date.

For MVP behavior:

- keep one current report per user per date
- regenerate by replacing/updating report contents
- perform the replacement transactionally

Recommended uniqueness:

```text
UNIQUE(user_id, report_date)
```

Do not create unlimited duplicate report rows every time the button is clicked unless report versioning is explicitly added later.

---

# 14. API Versioning

All public API routes should be versioned.

Use:

```text
/api/v1
```

Examples:

```text
GET    /api/v1/health

POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout

GET    /api/v1/connections
POST   /api/v1/connections/github
POST   /api/v1/connections/gitlab
DELETE /api/v1/connections/:id

GET    /api/v1/repositories
PATCH  /api/v1/repositories/:id

GET    /api/v1/reports
GET    /api/v1/reports/:date
POST   /api/v1/reports/generate
```

---

# 15. API Response Format

Use a consistent response structure.

Success:

```json
{
  "success": true,
  "data": {}
}
```

List response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request.",
    "details": []
  }
}
```

Do not expose internal stack traces to clients.

---

# 16. Validation

Every endpoint must validate:

- route parameters
- query parameters
- request body
- relevant headers

Use Zod schemas.

Do not trust frontend validation.

Frontend validation is a user-experience feature.

Backend validation is mandatory security and correctness logic.

---

# 17. Rate Limiting

The API must use rate limiting.

Use `@fastify/rate-limit` or a compatible maintained Fastify plugin.

At minimum, configure:

## Global limit

Example starting policy:

```text
100 requests / minute / IP
```

## Authentication endpoints

Use stricter limits.

Example:

```text
POST /auth/login
10 requests / minute / IP
```

```text
POST /auth/register
5 requests / minute / IP
```

## Report generation

Report generation is expensive and calls external providers.

Apply both:

```text
5 report generation requests / minute / user
```

and a concurrency guard:

```text
1 active report generation request / user
```

The same user must not be able to start several report generations simultaneously.

If a report generation is already running, return:

```http
409 Conflict
```

Example response:

```json
{
  "success": false,
  "error": {
    "code": "REPORT_GENERATION_IN_PROGRESS",
    "message": "A report is already being generated for this account."
  }
}
```

Do not solve duplicate generation only with frontend button disabling.

Backend enforcement is mandatory.

---

# 18. External Provider Rate Limits

GitHub and GitLab APIs have their own rate limits.

Provider implementations must:

- detect HTTP 429
- detect relevant provider rate-limit responses
- respect `Retry-After` where provided
- return a domain-specific error
- avoid uncontrolled retry loops

Do not automatically retry indefinitely.

For synchronous MVP requests, prefer failing with a useful message rather than blocking the API request for a long time.

Example domain error:

```text
GIT_PROVIDER_RATE_LIMITED
```

---

# 19. Request Timeout

External API calls must have explicit timeouts.

Do not allow GitHub/GitLab requests to wait forever.

Recommended starting point:

```text
10-15 seconds per external request
```

The overall report request should also have a reasonable maximum duration.

Timeout values should be configurable.

---

# 20. Security

Use:

- `@fastify/helmet`
- secure cookies in production
- HTTP-only cookies
- SameSite settings appropriate for the deployment
- CSRF protection where applicable
- strict CORS configuration
- encrypted provider credentials
- password hashing using Argon2id or another appropriate modern password hashing algorithm

Never use plaintext passwords.

Never store OAuth tokens unencrypted at rest when avoidable.

Never return OAuth tokens from API endpoints.

---

# 21. Error Handling

Create domain-specific application errors.

Examples:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
GIT_PROVIDER_UNAVAILABLE
GIT_PROVIDER_RATE_LIMITED
GIT_AUTH_EXPIRED
REPORT_GENERATION_IN_PROGRESS
REPORT_GENERATION_FAILED
```

Controllers/routes should not contain repetitive `try/catch` blocks.

Use a centralized Fastify error handler.

---

# 22. Human-Readable Code Rule

Code must prioritize readability for another developer.

Do not generate unnecessarily clever or compressed code.

Prefer:

```ts
const report = await reportService.generate({
  userId,
  date,
  connectionIds,
});
```

over deeply nested or overly functional one-line expressions.

Rules:

- use descriptive variable names
- use descriptive function names
- keep functions focused
- avoid functions with many responsibilities
- avoid unnecessary nesting
- use early returns when appropriate
- avoid unexplained magic numbers
- extract reusable constants
- prefer explicit code over clever code
- do not leave dead code
- do not leave debug `console.log`
- do not leave commented-out old implementations
- avoid `any`
- avoid unsafe type assertions
- avoid duplicated business logic

Comments should explain **why**, not repeat what the code already says.

Bad:

```ts
// Get user
const user = await getUser(id);
```

Better:

```ts
// Provider identity is checked here because the OAuth callback
// cannot trust the username supplied by the browser.
const providerUser = await provider.getCurrentUser();
```

---

# 23. ESLint

ESLint is mandatory.

The project must have an ESLint configuration suitable for TypeScript.

At minimum, enforce rules that catch:

- unused variables
- accidental `any`
- floating promises
- unsafe promise handling
- unreachable code
- duplicate imports
- inconsistent imports
- obvious TypeScript misuse

A feature is not complete when linting fails.

Required command:

```bash
npm run lint
```

It must exit with code `0`.

Do not disable lint rules globally just to make generated code pass.

If a rule must be disabled locally, add a short explanation.

---

# 24. Prettier

Prettier is mandatory for consistent formatting.

Required commands:

```bash
npm run format
npm run format:check
```

Prefer automated formatting instead of manually aligning whitespace.

Linting and formatting are separate checks.

---

# 25. TypeScript Rules

TypeScript must run in strict mode.

Recommended:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

Required command:

```bash
npm run typecheck
```

Do not suppress TypeScript errors with:

```ts
// @ts-ignore
```

unless absolutely necessary and accompanied by an explanation.

Avoid:

```ts
as any
```

---

# 26. Unit Testing Is Mandatory

Every feature must include tests.

A feature is not finished because it works manually.

It is finished only when its expected behavior is covered by automated tests.

Use Vitest.

Required command:

```bash
npm test
```

or:

```bash
npm run test
```

---

# 27. Testing Strategy

Use three levels where appropriate.

## Unit Tests

Test business logic in isolation.

Examples:

- report grouping
- date range calculation
- provider response mapping
- repository filtering
- report totals
- normalization
- deduplication
- authorization decisions

## Route / Integration Tests

Test Fastify endpoints using `app.inject()`.

Examples:

```text
POST /api/v1/reports/generate
```

must test:

- authenticated request succeeds
- unauthenticated request fails
- invalid date fails
- another user's connection fails
- disabled repository is ignored
- duplicate generation is blocked
- provider error is handled
- rate limit is enforced
- successful report is persisted

## Provider Tests

Do not call real GitHub/GitLab APIs in normal unit tests.

Mock provider HTTP responses.

Test mapping and error behavior using fixtures.

---

# 28. Test Naming

Tests should describe observable behavior.

Prefer:

```ts
it('rejects report generation for a connection owned by another user')
```

instead of:

```ts
it('test generate report 2')
```

Use Arrange / Act / Assert structure where useful.

---

# 29. Test Coverage

Coverage percentage is not the only quality metric.

However, important business logic must not be left untested.

Suggested initial minimum:

```text
Statements: 80%
Branches:   75%
Functions:  80%
Lines:      80%
```

Critical security and authorization paths should aim for complete branch coverage.

Do not write meaningless tests solely to increase coverage numbers.

---

# 30. Definition of Done

A backend feature is complete only if:

- implementation is finished
- request validation exists
- authorization is enforced
- unit tests pass
- integration tests pass where appropriate
- lint passes
- formatting passes
- TypeScript typecheck passes
- Swagger documentation is updated
- error cases are handled
- rate limiting is considered
- secrets are not logged
- no unrelated regressions are introduced

Before declaring a task complete, run:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
```

All must pass.

---

# 31. Swagger / OpenAPI Documentation

Every public API endpoint must be documented.

Use:

```text
@fastify/swagger
@fastify/swagger-ui
```

Recommended documentation route:

```text
/docs
```

Recommended raw OpenAPI route:

```text
/docs/json
```

Swagger documentation must include:

- endpoint summary
- endpoint description when necessary
- tags
- authentication requirements
- path parameters
- query parameters
- request body schema
- success response
- expected error responses

Example tags:

```text
Auth
Connections
Repositories
Reports
System
```

Do not leave undocumented endpoints.

---

# 32. Swagger Must Match Runtime Validation

Avoid maintaining unrelated duplicate schemas for:

```text
runtime validation
Swagger documentation
TypeScript types
```

Prefer a schema approach that keeps these contracts synchronized.

If Zod-to-OpenAPI tooling is used, confirm that it integrates cleanly with the selected Fastify version.

The OpenAPI contract must reflect actual API behavior.

---

# 33. Health Endpoint

Provide:

```http
GET /api/v1/health
```

Example:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

Do not expose sensitive infrastructure details.

---

# 34. Logging

Use structured logging through Fastify/Pino.

Logs should include useful context such as:

- request ID
- route
- method
- response status
- duration
- user ID when safe
- provider name when relevant

Do not log secret credentials.

Use request correlation IDs for debugging.

---

# 35. Database Transactions

Use transactions when a business operation updates multiple related records.

Report regeneration should be atomic.

Example:

```text
BEGIN

update report
delete/rebuild report items
insert new report items

COMMIT
```

If generation fails before persistence, the existing valid report should remain intact.

Do not delete the old report before successfully obtaining the replacement data.

---

# 36. Date and Timezone Rules

Daily reports must be generated according to the user's timezone.

Do not assume server timezone.

Store timestamps in UTC.

Store the user's preferred timezone separately.

Example:

```text
Asia/Jakarta
```

When generating a report for:

```text
2026-08-17
```

calculate the start/end range in the user's timezone, then convert the boundaries to UTC when querying providers.

Timezone logic must have unit tests.

---

# 37. Repository Selection

Users must be able to enable or disable repositories.

Report generation should only query repositories that:

- belong to one of the selected connections
- are authorized
- are enabled by the user

Do not silently include all repositories after the user has made an explicit selection.

---

# 38. Report Generation Service

Business logic belongs in services, not routes.

Preferred:

```ts
await reportService.generateReport({
  userId,
  reportDate,
  connectionIds,
});
```

The service may coordinate:

```text
ConnectionService
RepositoryService
GitProviderFactory
ActivityNormalizer
ActivityGrouper
ReportRepository
```

Routes should remain thin.

---

# 39. Provider Factory

Use one provider factory or registry.

Example:

```ts
const provider = gitProviderFactory.create(connection);
```

Do not scatter code like this across controllers:

```ts
if (provider === 'github') {
  // ...
} else if (provider === 'gitlab') {
  // ...
}
```

Provider branching belongs in the provider layer.

---

# 40. External HTTP Client

Create a consistent HTTP abstraction for provider calls.

It should support:

- timeout
- headers
- bearer authentication
- JSON parsing
- provider error mapping
- request IDs where useful

Do not duplicate HTTP error handling in every provider method.

---

# 41. Pagination

Git providers paginate repository and activity responses.

Provider implementations must correctly handle pagination.

Tests must cover multiple-page responses.

Do not assume one API response contains all commits or repositories.

---

# 42. Deduplication

Activities may appear through multiple provider endpoints.

Normalize and deduplicate them before report generation.

Use stable external identifiers where available.

For commits, SHA + repository is normally a useful unique reference.

Deduplication logic must have unit tests.

---

# 43. Report Grouping

Do not treat every commit as one final task.

The report layer should be able to group related commits.

MVP grouping may initially be rule-based.

Example input:

```text
fix line dropdown
fix line filter
fix api line parameter
```

Possible output:

```text
Daily Preventive Filtering

- Fixed line selection
- Corrected API filtering behavior
```

Keep raw source references available so users can inspect which commits produced a report item.

Do not add AI summarization until explicitly requested.

---

# 44. No Premature AI Integration

The first release should generate useful reports without requiring an external AI API.

Start with:

- commit messages
- merge request titles
- pull request titles
- deterministic grouping rules
- simple text templates

AI summarization can be added later as an optional module.

This keeps development cost, privacy risk, and deployment complexity low.

---

# 45. Concurrency Protection

Manual generation does not mean unlimited synchronous requests are acceptable.

Implement a backend guard so one user can have only one report-generation operation active at a time.

For a single API instance, an in-memory lock may be used for the initial MVP.

Design the lock behind an interface so it can later be replaced by Redis or a database lock if multiple API instances are deployed.

Example:

```ts
interface ReportGenerationLock {
  acquire(userId: string): Promise<boolean>;
  release(userId: string): Promise<void>;
}
```

Always release locks with `finally`.

---

# 46. Idempotency

Where practical, design generation so repeated requests do not corrupt data.

Generating the same user/date twice should result in one valid current report.

A failed request must not leave partial report records.

---

# 47. Authentication and Authorization

Authentication answers:

```text
Who is the user?
```

Authorization answers:

```text
Can this user access this resource?
```

Every resource lookup involving user-owned data must enforce ownership.

Never trust resource IDs supplied by the frontend without verifying ownership.

Example:

```ts
const connection = await connectionRepository.findOwnedByUser(
  connectionId,
  userId,
);
```

Prefer ownership-aware repository methods over fetching globally and checking inconsistently later.

---

# 48. Password Rules

If local email/password authentication is implemented:

- hash passwords with Argon2id
- enforce reasonable minimum password requirements
- never expose whether a specific email exists unnecessarily
- rate limit login attempts
- rotate session after successful login
- invalidate the session on logout

OAuth login for the application itself may be added later.

---

# 49. HTTP Status Codes

Use meaningful HTTP status codes.

Examples:

```text
200 OK
201 Created
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests

500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
```

Do not return `200` for failed business operations.

---

# 50. API Controller Rule

Controllers/routes should handle HTTP concerns only.

They may:

- parse validated input
- read authenticated user
- call services
- map service output to HTTP response

They should not:

- contain provider-specific API logic
- execute large Prisma queries directly
- implement report grouping
- encrypt/decrypt tokens
- contain complex authorization logic

---

# 51. Database Access Rule

Keep Prisma access inside repository/data-access modules or well-defined services.

Avoid spreading database queries throughout routes.

This makes business logic easier to unit test.

---

# 52. Dependency Injection

Use lightweight dependency injection.

Do not introduce a large DI framework unless needed.

Dependencies may be passed explicitly:

```ts
const reportService = new ReportService({
  reportRepository,
  connectionRepository,
  providerFactory,
  generationLock,
});
```

This improves testability.

---

# 53. Mockable Dependencies

Anything that touches an external system should be mockable:

- GitHub
- GitLab
- database repositories
- clock/date provider when useful
- encryption
- mail provider if introduced later

Do not make unit tests depend on the internet.

---

# 54. Migrations

Every database schema change must have a Prisma migration.

Do not modify production schema manually.

Migration names should be descriptive.

Example:

```text
add_report_generation_fields
add_git_connection_base_url
```

---

# 55. Seed Data

Development seed scripts may create:

- development user
- fake Git connections
- fake repositories
- sample report history

Never seed real tokens.

---

# 56. Git Rules for Development

Keep commits focused.

Prefer:

```text
feat(reports): add manual report generation
test(reports): cover concurrent generation
docs(api): document report generation endpoint
```

Avoid commits such as:

```text
update
fix
changes
final
```

Do not commit:

- `.env`
- credentials
- private keys
- OAuth tokens
- generated coverage directories
- local database dumps

---

# 57. Suggested NPM Scripts

The project should provide scripts similar to:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

Exact commands may change depending on the final monorepo layout.

---

# 58. CI Quality Gate

When CI is introduced, it must run at minimum:

```text
install dependencies
      ↓
lint
      ↓
format check
      ↓
typecheck
      ↓
unit/integration tests
      ↓
build
```

A pull request should not be considered mergeable when any required quality check fails.

---

# 59. MVP Feature Order

Implement features in this order unless instructed otherwise.

## Phase 1 — Foundation

1. Initialize TypeScript + Fastify project.
2. Configure environment validation.
3. Configure PostgreSQL + Prisma.
4. Configure structured logging.
5. Configure centralized error handling.
6. Configure ESLint.
7. Configure Prettier.
8. Configure Vitest.
9. Configure Swagger/OpenAPI.
10. Configure security plugins.
11. Configure global rate limiting.

## Phase 2 — Authentication

1. User model.
2. Register.
3. Login.
4. Session handling.
5. Logout.
6. Authorization helpers.
7. Authentication tests.
8. Swagger documentation.

## Phase 3 — Git Connections

1. Git provider interface.
2. Provider factory.
3. GitHub App connection.
4. GitLab.com OAuth.
5. Self-hosted GitLab OAuth.
6. Connection encryption.
7. Connection list/disconnect.
8. Provider tests.
9. Route tests.
10. Swagger documentation.

## Phase 4 — Repositories

1. Fetch authorized repositories.
2. Normalize repositories.
3. Persist repository metadata.
4. Enable/disable repositories.
5. Repository authorization.
6. Pagination handling.
7. Tests.
8. Swagger documentation.

## Phase 5 — Report Generation

1. Date/timezone service.
2. Fetch commit activity.
3. Normalize activity.
4. Deduplicate activity.
5. Group activity.
6. Generate report structure.
7. Persist report transactionally.
8. Regenerate existing report.
9. Add generation concurrency lock.
10. Add report-generation rate limit.
11. Add unit tests.
12. Add endpoint integration tests.
13. Document endpoint in Swagger.

## Phase 6 — Report History

1. List reports.
2. Fetch report by date.
3. Pagination.
4. Ownership validation.
5. Tests.
6. Swagger documentation.

Frontend work begins after the required backend APIs for the relevant phase are stable.

---

# 60. Out of Scope for MVP

Do not implement unless explicitly requested:

- cron jobs
- scheduled reports
- Redis
- BullMQ
- worker services
- microservices
- Kafka
- RabbitMQ
- automatic email delivery
- Slack delivery
- Teams delivery
- AI summarization
- source-code indexing
- Git write operations
- automatic code review
- mobile applications
- Kubernetes

Keep the MVP intentionally small.

---

# 61. Agent Working Rules

When an AI coding agent works on this repository:

1. Read this file before changing code.
2. Inspect existing architecture before creating new patterns.
3. Do not rewrite unrelated working code.
4. Prefer small focused changes.
5. Reuse existing shared utilities.
6. Follow existing naming conventions.
7. Add or update tests with every behavior change.
8. Update Swagger whenever an API contract changes.
9. Run lint after modifications.
10. Run typecheck after modifications.
11. Run relevant tests after modifications.
12. Run the full test suite before completing a major feature.
13. Never claim tests pass without running them.
14. Never silently ignore a failing test.
15. Do not disable validation, linting, or tests to make code pass.
16. Do not introduce new infrastructure without a demonstrated need.
17. Never expose credentials in logs or responses.
18. Keep user-owned data isolated by authenticated user ID.
19. Maintain read-only Git provider permissions.
20. Document meaningful architectural changes.

---

# 62. Required Verification Before Completing Any Feature

Before reporting that a backend feature is complete, execute:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

If any command fails:

- fix the cause, or
- clearly state the failure and why it cannot be fixed

Never describe the feature as complete while mandatory verification is failing.

---

# 63. Core Principle

The project should favor:

```text
Correctness
    ↓
Security
    ↓
Readability
    ↓
Testability
    ↓
Maintainability
    ↓
Performance optimization
```

Do not sacrifice correctness or readability for premature optimization.

The desired backend should be understandable by another human developer without requiring the original author or an AI agent to explain every function.
