# Bandara — UI/browser testing contribution

**H.R.M.A.A. Bandara · IT24100315 · SE3112**

Ownership: browser UI and E2E tests, their fixtures/configuration, and local evidence only.
All tests here are newly authored for this contribution. Existing upstream tests and
other members' suites are not part of this work.

## Verified application and prerequisites

Testing repository: `Smart-Restaurant-Management-System1/Cinnamon-Bistro-SE3112-Test-Automation`.
Base: `origin/develop` at `18f242dd7853c5021f74630bca335f69b4bebaaf`.
Read-only CSP reference: `Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System`,
`develop` at `ee41765622ac458399bd208171d930dcb6a070a9`.

Use Node 22.16+ and npm, Chromium, and the actual React/Vite frontend.
The reference checkout is a sibling named `Cinnamon-Bistro-CSP-Reference` by default.
If missing, from the testing repository root:

```powershell
git clone --branch develop --single-branch https://github.com/Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System.git ../Cinnamon-Bistro-CSP-Reference
```

Install without modifying tracked application files:

```powershell
# From testing repository root
Push-Location ../Cinnamon-Bistro-CSP-Reference/frontend/restaurant-web
npm ci --ignore-scripts
Pop-Location
cd e2e-tests
npm ci
npx playwright install chromium
# On Linux CI: npx playwright install --with-deps chromium
npm test
npm run report
# Capture the actual report in Chromium:
npm run evidence:report
```

`npm test` starts Vite at `http://127.0.0.1:5173` and waits for HTTP readiness.
It refuses to reuse an unknown server on that port. Playwright stops its server after execution.
To start manually, use `npm run start:app` in one terminal, and set
`$env:E2E_BASE_URL='http://127.0.0.1:5173'` before `npm test` in another.
For a headed demo: `npm run test:headed`.

Configuration environment variable names (no secrets required by this suite):

| Name | Meaning |
| --- | --- |
| `E2E_APP_PATH` | Application repository root, absolute or relative to `e2e-tests/`; for CI checkout use `../target-app` |
| `E2E_BASE_URL` | Existing local/test frontend URL; disables automatic server startup |
| `VITE_API_URL` | Identity API base; launcher defaults explicitly to `http://127.0.0.1:5001/api` |
| `VITE_RESERVATION_API_URL` | Reservation API base; launcher defaults explicitly to `http://127.0.0.1:5000/api` |

The launcher overrides deployment-oriented application env defaults. Use local/test URLs only.
Do not edit application `.env` files, frontend code, or shared pipeline configuration.

## Scenarios and classification

**This is a network-isolated browser UI suite, not full-stack E2E.**
It runs the real application components in Chromium. Authenticated tests install a
synthetic customer session and intercept API requests with `page.route()`.
Public validation/navigation tests require no API responses. This classification applies to
the default 13-test suite. The separately invoked live Identity extension is documented below.

| Test | What it proves |
| --- | --- |
| Landing navigation | Actual hero, About URL/focus, Get Started routes to registration |
| Mobile navigation | Menu expands; Escape closes it and returns keyboard focus |
| Guest route protection (3 cases) | `/menu`, `/cart`, `/availability` redirect to login |
| Empty/malformed login | Visible field errors and zero API submissions |
| Mocked login rejection | Correct request payload; 401 message; unauthenticated state |
| Registration validation | Required-field and password-mismatch feedback; no registration request |
| Menu filters | Category/dietary/search query parameters; returned cards, descriptions/prices, empty results and reset |
| Menu error/retry | API failure message, absent cards, successful recovery |
| Cart journey | Add request, cart navigation, quantity increase/decrease, subtotals, removal and empty cart |
| Reservation validation | Missing date/time, zero guests and past time rejected without availability requests |
| Reservation search | Date/time/duration/guest query; returned table number/capacity and enabled reservation action |

Fixtures follow inspected `authService.js`, `menuService.js`, `cartService.js`,
`tableService.js`, `notificationService.js`, `AuthContext.jsx`, and backend DTOs
`LoginResponseDto`, `OrderCartResponseDto`, `OrderCartItemResponseDto`, `AvailableTableResponseDto`.
Fixtures model server responses to exercise frontend behavior; they do not verify server filtering,
authorization, persistence or calculation. Unexpected API requests fail fixture teardown.
External requests are blocked. Fresh browser contexts and per-test fixture state isolate tests.
Selectors use roles/labels; the existing `#about` anchor is used for its focus assertion.
No fixed sleeps, retries, skipped tests, production accounts or payments are used.

## Reports and evidence

All outputs are local and Git ignored:

- `test-reports/e2e/junit.xml`
- `test-reports/e2e/report/index.html`
- `test-reports/e2e/artifacts/` — failure screenshot/video/trace; representative landing/cart screenshots
- `test-reports/e2e/evidence/report.png` — browser capture of the generated report

Paths above are relative to the testing repository root. Reporter paths are resolved
from the config location, independently of the invocation directory. Assertion failures
propagate Playwright's nonzero exit status. Reports are overwritten on each run.
Use `npx playwright show-trace <trace.zip>` for a failed test trace.
Execution results and exact evidence paths are recorded below after local verification.

### Actual local execution — 18 October 2026

Windows, Node 22.16.0, npm 10.9.2, Playwright 1.58.2, Chromium 145.

| Command (from `e2e-tests/`) | Result | Exit |
| --- | --- | --- |
| `npm install --save-exact --save-dev @playwright/test@1.58.2` | Installed 3 packages; 0 audit findings | 0 |
| `npx playwright install chromium` | Installed Chromium, headless shell, FFmpeg and Winldd | 0 |
| `node node_modules/@playwright/test/cli.js test --headed --grep "add to cart"` | 1 passed, 0 failed, 0 skipped (manual local Vite; `E2E_BASE_URL` set) | 0 |
| `npm test` | 13 passed, 0 failed, 0 skipped; 33.3 seconds | 0 |
| `npm test` (repeat, output saved via `Tee-Object`) | 13 passed, 0 failed, 0 skipped; 36.2 seconds | 0 |
| `npm run evidence:report` | Captured and visually inspected the actual HTML report | 0 |

The reference frontend's `npm ci --ignore-scripts` also exited 0 (452 packages);
it reported 4 existing dependency vulnerabilities (2 moderate, 2 high). Application
dependency remediation belongs to the application maintainers and was not performed.

An initial `npm run test:headed -- --grep "add to cart"` invocation lost its grep
option through this machine's npm PowerShell shim and returned 1 with no tests found;
the direct Node CLI above is the verified alternative. An initial sandboxed headless
run displayed all passing tests but hung during Windows teardown and was interrupted
(exit 1); it is not counted as a completed passing run. Both complete headless runs
used the environment's approved process permissions and finished normally.

Failure-contract verification used a **Git-ignored temporary copy**, changing only
the cart's expected `Rs. 2,400.00` to deliberately wrong `Rs. 2,400.01`.
`node node_modules/@playwright/test/cli.js test --config .runtime/failure.config.js
--grep "add to cart"` actually produced **0 passed, 1 failed, 0 skipped; exit 1**,
with failure screenshot/video/trace. This is an intentional assertion probe, not an
application defect or a failing committed test. Its outputs are separate from the
passing suite under `test-reports/e2e/failure-proof/`.

Evidence (relative to repository root):

- `test-reports/e2e/evidence/headless-repeat.log` — actual repeat-run console output
- `test-reports/e2e/evidence/failure-proof.log` — deliberate assertion failure output
- `test-reports/e2e/evidence/report.png` — report showing all 13 passing tests
- `test-reports/e2e/artifacts/customer-mocked-ui-Mocked--9043f--visible-quantity-and-price-chromium/cart-quantity-two.png`
- `test-reports/e2e/artifacts/public-ui-Public-UI-networ-0325c-tion-and-opens-registration-chromium/landing.png`
- `test-reports/e2e/failure-proof/artifacts/` — intentional failure screenshot, video and trace

Reports/screenshots are deliberately not committed. Attach `report.png` and the cart
screenshot by dragging these local files into the GitHub PR description or a PR comment.

## Original 18 October infrastructure limitation and team-lead handoff

The application has .NET 10 identity/reservation services with MySQL 8 and Kafka.
Docker CLI is installed locally, but `com.docker.service` and `MySQL80` are stopped;
`docker info` cannot connect because the Docker named pipe is absent. No isolated
database/seeded test accounts were supplied. A real backend journey is therefore
unverified at that stage. Mocked success is not evidence of database or cross-service correctness.
The separate extension below provisions its own database instead of using these services.

For a future full-stack run, the lead must provision an isolated local test stack:
initialize its MySQL schemas/migrations, start identity on 5001 and reservation on
5000, configure both API bases, and verify readiness plus disposable accounts.
Reservation source supports `Kafka__PublisherEnabled=false` when Kafka is deliberately
excluded; such a run would not validate event publication. Required backend configuration
names include `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Jwt__Issuer`,
`Jwt__Audience`. Both service `Data/DatabaseHelper.cs` files confirm `DefaultConnection`.
After provisioning, the source startup commands are `dotnet run --project
backend/identity-service --no-launch-profile --urls http://127.0.0.1:5001` and
`dotnet run --project backend/reservation-service --no-launch-profile --urls
http://127.0.0.1:5000` from the CSP root. These backend commands have not been run here;
the blocked prerequisites must be resolved first. These are not used by the mocked suite.
Do not use tracked deployment credentials or production data. No payment journey is covered.

Shared CI changes are deliberately left to the lead. Exact integration steps:
checkout CSP into `target-app/`; set `E2E_APP_PATH=../target-app`; install its frontend
lockfile with `npm ci --ignore-scripts`; in `e2e-tests/` run `npm ci`,
`npx playwright install --with-deps chromium`, then `npm test`; upload
`test-reports/e2e/` even on failure and retain the command's exit code.
The lead must implement these steps in the shared workflow and request peer review.

## Two-minute demo and VIVA

- 0–20s: identify name/ID, UI ownership and real React frontend; explain mocked APIs.
- 20–70s: run the cart test headed; show add, quantity/price assertions and removal.
  Command: `node node_modules/@playwright/test/cli.js test --headed --grep "add to cart"`.
- 70–100s: open the report and show reservation validation/request assertions.
  If a genuine failure occurred, show its screenshot/trace; do not invent a failure artifact.
- 100–120s: explain nonzero failure exit, report handoff and full-stack prerequisite gap.

VIVA: role/label selectors follow user-visible semantics; Playwright assertions wait for
observable state instead of timing guesses. Per-test contexts/fixtures prevent shared state.
The cart test checks both visible state and outgoing mutations; reservation validation checks
that invalid input does not call the API. Retry recovery tests the UI's error path.
Mocks give controlled responses but cannot prove backend persistence, auth or integration.
These workflows exercise several UI components; they are distinct from unit tests of functions.

## Separate live Identity integration extension (IT24100315)

Branch: `feature/IT24100315-live-backend-e2e`, created from updated testing
`develop` at `44d3601c1caa18977db4e489dddfd99fb7d93dad` on 19 October 2026.

The existing `npm test` command, `tests/` files and `playwright.config.js` are preserved.
They still select only the original 13 deterministic browser UI cases. Live tests live in
`live/tests/`, carry `@live` in their titles, and require their own configuration and runner:

```powershell
# From e2e-tests/; install the updated lockfile and browser first
npm ci
npx playwright install chromium
npm run test:live
npm run report:live
```

### Actual boundaries and prerequisites

This suite exercises the real React frontend, actual .NET 10 Identity Service and a real
private MySQL 8 instance. It does not import the mocked UI fixture and never calls
`page.route()` or supplies fake API responses. The optional reservation scenario is not
implemented: reservation, Kafka, ordering and payments are outside this extension.

Required: Node 22.16+, .NET 10 SDK with NuGet restore access, installed Chromium,
and the application checkout identified by `E2E_APP_PATH` (same semantics as above).
Install its frontend dependencies with `npm ci --ignore-scripts` in
`frontend/restaurant-web/` before running. Application revision inspected:
`ee41765622ac458399bd208171d930dcb6a070a9` on CSP `develop`.

On Windows, native MySQL is the default. The runner starts a separate `mysqld.exe`;
it never starts, reconfigures or uses the installed MySQL service or its data directory:

```powershell
$env:E2E_LIVE_MYSQL_MODE='native'
$env:E2E_MYSQLD_PATH='C:/Program Files/MySQL/MySQL Server 8.0 New/bin/mysqld.exe'
npm run test:live
```

If using Docker instead, the owned Compose file starts only MySQL under a unique
per-run project and removes that project's volume after execution:

```powershell
$env:E2E_LIVE_MYSQL_MODE='docker'
npm run test:live
```

Docker mode requires a working Docker daemon and Compose v2, plus access to the pinned
`mysql:8.0.46` image. Native and Docker modes use the same schema and browser tests.
Docker mode is an available setup path, not a claim of a verified Docker run.

Default live ports are MySQL `33079`, Identity `15001`, frontend `15173`, all bound
to loopback. The runner refuses occupied or duplicate ports. Override with
`E2E_LIVE_DB_PORT`, `E2E_LIVE_IDENTITY_PORT`, `E2E_LIVE_FRONTEND_PORT` as needed.
The original default UI server on 5173 is independent.

### Database setup, account isolation and cleanup

`live/run-live.mjs` builds the application into ignored `.runtime/` artifacts. It
initializes a fresh native data directory or a private Compose volume, applies the
actual application `database/identity-db/01_init_identity.sql` and
`02_admin_user_management.sql`, substituting only the database name in memory with
`e2e_it24100315_identity`. The application files are not edited. It adds a harness
ownership marker containing a unique run ID. Database helpers refuse access unless
this marker matches the managed run.

All database/JWT/test passwords are randomly generated at runtime and passed only
through child-process environments. Do not supply production credentials or point
this runner at a shared database. Native initialization briefly uses the fresh
instance's empty bootstrap root account, then sets a random password before starting
Identity. No password is hardcoded or written into source configuration.

Registration uses unique `bandara-live-<UUID>@example.com` addresses and synthetic
names. Identity's existing `EmailValidation__SkipDnsCheck=true` setting avoids an
external DNS dependency; email syntax, disposable-domain checks, actual registration,
BCrypt authentication and database calls still run. No verification email is sent by
the inspected registration implementation. DNS/email deliverability is not covered.

Each test owns its account. Login tests seed independently through the real register
API; they never depend on the UI registration test or a pre-existing account. Fixture
`finally` cleanup deletes only that exact email and verifies zero remaining Users and
UserRoles mappings. The runner additionally requires zero total Users/UserRoles before
shutdown, so missed cleanup fails the command even if the browser assertions passed.
Services stop in `finally`, including on test/build failure. Ignored native data and
build directories remain for diagnostics; they are not submission artifacts.

### Three live scenarios

| Test | Setup/action | Assertions |
| --- | --- | --- |
| Browser customer registration | Fresh account; fill real registration form and submit | Real `POST /api/auth/register` returns 201; response identity/Customer role; visible success; stored user/role and non-plaintext password; current redirect ends at login because registration does not authenticate |
| Successful customer login/profile | Independently register a test account through the real API; visit protected `/profile`, then log in | Real login returns 200; frontend returns to `/profile`; real authenticated `GET /api/users/profile` returns 200 and the same email; visible name/email match; authenticated state exists |
| Rejected existing-user login | Independently register a test account; submit a different password in the browser | Real login returns 401; actual error message appears; stays at login; no authenticated state; seeded user remains until fixture cleanup |

The profile layout's unrelated notification counter attempts the reservation API on
loopback port 15000, which this identity-only stack does not start. That counter is
not mocked or asserted; its unavailable-service fallback is outside the tested journey.
No claim of complete reservation-service integration is made.

### Live diagnostics and integration ownership

Live results are separate and Git ignored:

- `test-reports/e2e-live/junit.xml`
- `test-reports/e2e-live/report/index.html`
- `test-reports/e2e-live/artifacts/` — representative screenshots, failure screenshots/videos, sanitized API/cleanup attachments
- `test-reports/e2e-live/startup/` — build, MySQL, Identity, frontend and Playwright logs
- `test-reports/e2e-live/run-summary.json` — actual command exit and aggregate cleanup verification

If infrastructure fails before browsers run, no new JUnit/HTML result is produced;
check the latest `run-summary.json` and startup logs rather than treating an older
report as a result for that attempt.

Authentication traces/HARs are disabled because they capture passwords and JWTs.
The live reporter redacts generated test passwords from diagnostic step titles and
errors before HTML/JUnit reporters serialize them. Traffic attachments contain only
method, endpoint path and status; no request/response bodies, tokens or credentials.

Live commands remain opt-in. No shared GitHub Actions workflow is changed and no
live CI execution is claimed. The lead must separately decide whether/where to run
this stack; `npm run test:live` must never replace `npm test` in default CI.

### Verified extension results — 19 October 2026

Windows; Node 22.16.0; .NET SDK 10.0.400; MySQL 8.0.46; Playwright 1.58.2.

| Command | Actual final result | Exit |
| --- | --- | --- |
| `npm.cmd run test:live` (native private MySQL) | 3 passed, 0 failed, 0 skipped; 27.6 seconds of Playwright execution | 0 |
| `npm.cmd test` (run after live services stopped) | Existing 13 passed, 0 failed, 0 skipped; 50.2 seconds | 0 |

The final `run-summary.json` records `success=true`, `cleanupVerified=true`,
`remainingUsers=0`, `remainingUserRoles=0`, `testExitCode=0`, `exitCode=0`.
Each live report contains a `real-api-and-cleanup` attachment: registration POST 201;
login POST 200 plus profile GET 200; wrong-password POST 401. Each test deleted its
one owned account and verified zero remaining user/role mappings. The report's embedded
JSON was inspected for generated test-password and issued-JWT patterns; none were found.

Actual successful-run browser evidence is in `test-reports/e2e-live/artifacts/`:
`real-registration-complete.png`, `real-authenticated-profile.png`, and
`real-login-rejected.png`, each within its corresponding test directory.
The actual HTML report was also captured in Chromium as
`test-reports/e2e-live/evidence/report.png` and visually inspected alongside the
authenticated profile screenshot. Attach these local PNGs to the PR manually;
generated evidence is deliberately not committed.

Earlier attempts are not counted as passing: the first managed run stopped before
tests because private MySQL startup exceeded a 90-second readiness window (exit 1).
The next run returned 2 passed/1 failed (exit 1): registration's full document reload
hit the 30-second test deadline after the 201/persistence checks passed. Cleanup was
still verified. Its JUnit/HTML/log/summary are retained under
`test-reports/e2e-live/evidence/first-browser-attempt/`. The initial readiness failure
summary is `evidence/initial-mysql-readiness-failure.json`.

The live-only configuration now uses a 60-second test limit and 15-second assertion
limit; MySQL readiness is bounded at 180 seconds, initialization at 300 seconds, and
HTTP readiness requests at 2 seconds. Assertions and the existing suite were not weakened
or edited. The successful final run used another fresh database. Native initialization
can take several minutes on this Windows machine, separate from the 27.6-second test time.
An initially concurrent default run was interrupted during startup and is not claimed
as a passing execution; the complete sequential 13-case result above is the verification.

Remaining limitations: Docker mode and live CI execution are unverified; the reservation
workflow is not included; external DNS deliverability is deliberately disabled through
the application's existing test configuration. Global MySQL/Docker services remain
stopped. The isolated native run does not depend on them.


### Optional real reservation journey ? 19 October 2026

This extension adds **one independently isolated Playwright test** with a successful
booking and a stale-tab conflict case. It uses the real React frontend, running
Identity Service, Reservation Service and their local MySQL databases. There is no
`page.route()` or fabricated backend response in this suite. The existing three
managed Identity tests and 13 default browser tests remain separate and unchanged.

The earlier statement that global services were stopped describes the Identity-only
run above. For this reservation verification, the developer started the real local
services on ports 5001 and 5000 and authorized temporary local database records.
Docker is not required for this command; Docker execution is not claimed.

#### Prerequisites and startup

Use a **local test installation**, never production/shared customer databases.
Initialize the application's Identity and Reservation schemas using its documented
SQL migration sequence before starting; this harness does not migrate, reset, seed
standard tables in, or drop an existing database. Required reservation tables include
RestaurantTables, Reservations, ReservationOutbox and CustomerNotifications.

Start MySQL and the two application services yourself. In separate terminals, from
the application root (replace the path with your checkout):

```powershell
cd <application-root>
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project backend/identity-service --urls http://localhost:5001
# Separate terminal, same application root and Development environment:
dotnet run --project backend/reservation-service --urls http://localhost:5000
```

The services need compatible JWT settings, initialized user roles, and Reservation
Service access to the Identity Users table for its account-status validation.
Install application frontend dependencies with `npm ci` in
`frontend/restaurant-web`; install this contribution's dependencies with `npm ci`
and `npx playwright install chromium` in `e2e-tests`.

Run from `e2e-tests`:

```powershell
$env:E2E_SERVICE_APP_PATH = 'B:\SLIIT\Y3S1\CSP\Smart-Restaurant-Management-System'
$env:E2E_RESERVATION_ALLOW_LOCAL_WRITES = '1'
npm.cmd run test:live:reservation
npm.cmd run report:live:reservation
```

`E2E_SERVICE_APP_PATH` is configurable and points at the checkout used by the running
services. Its files are read only. The helper reads ConnectionStrings.DefaultConnection
from appsettings.json with appsettings.Development.json overriding it; credentials
stay in memory and are not copied into this repository. Environment-variable/user-secret
connection overrides are not resolved by this helper. The supported local connection
format uses Server, Port, Database, User (or User ID), Password. It refuses nonloopback
hosts and database names other than restaurant_identity_db / restaurant_reservation_db.
Do not paste credentials into logs or commit local configuration.

`E2E_RESERVATION_ALLOW_LOCAL_WRITES=1` explicitly enables fixture writes. The runner
generates E2E_RESERVATION_RUN_ID and E2E_LIVE_ACCOUNT_PASSWORD itself. It starts only
a private Vite frontend on 127.0.0.1:15174; that port must be free and permitted by the
services' local CORS settings. API origins are fixed to localhost:5001 and localhost:5000.
It neither starts nor stops the developer's backend/MySQL services.

#### Scenario and isolation

The fixture registers a unique `bandara-res-<random>@example.com` Customer through
the real Identity API, verifies its persisted user, and inserts one unique
`E2E-<random>` table. The browser visits protected availability, logs in, searches
for a date seven days ahead at 18:00 for 60 minutes/two guests, and selects that exact
table by its visible heading. A second tab selects it before the first confirms.

Assertions verify real login 200, availability 200 and the owned table in the response;
first-tab booking 201, returned table/party/reference, confirmation URL and visible
reference; second-tab booking 409 with TABLE_NO_LONGER_AVAILABLE, the complete visible
conflict message and recovery link. SQL verifies exactly one Pending reservation
owned by the test user, with the expected table, party size and booking reference.
These two tabs are one test's controlled sequence; no test depends on another test.

Teardown closes browser activity and deletes only this unique user's reservation
records, matching reservation outbox rows, customer notifications, unique table,
user and cascading role mappings. It asserts zero remaining owned records. It does
not delete unrelated rows or reset either database. Cleanup failures fail the test.
The runner additionally requires cleanup.json to match the current run ID before
returning exit 0. Do not forcibly kill a run during teardown; if interrupted, use the
unique fixture identifiers in diagnostics to investigate before rerunning.

#### Actual results and evidence

| Command | Verified result | Exit |
| --- | --- | --- |
| `npm.cmd run test:live:reservation` (final) | 1 passed, 0 failed, 0 skipped; 13.6 seconds total | 0 |
| `npm.cmd test` (regression) | Existing 13 passed, 0 failed, 0 skipped; 44.9 seconds total | 0 |

The immediately preceding reservation run also passed (12.7 seconds total). The final
run validates the additional runner safeguard requiring matching cleanup evidence.
The real traffic/cleanup report attachment records login 200, availability 200,
booking 201 and conflict 409; cleanup removed one reservation and verified zero
remaining owned reservations, notifications, outbox events, tables, users and role
mappings. No total-database row counts or customer data are included in evidence.

Earlier failures are retained honestly: the first attempt timed out on an exact label
selector (1 failed, exit 1); the second reached real 201/409 but failed because an exact
alert assertion also included its recovery link (1 failed, exit 1). The corrected
assertion checks the full message and the recovery link separately. Archives are
`test-reports/e2e-reservation-live-first-attempt/` (report/JUnit/summary) and
`test-reports/e2e-reservation-live-second-attempt/` (including failure artifacts).

Latest generated evidence, all ignored by Git:

- `test-reports/e2e-reservation-live/junit.xml`
- `test-reports/e2e-reservation-live/report/index.html`
- `test-reports/e2e-reservation-live/run-summary.json`
- `test-reports/e2e-reservation-live/cleanup.json`
- `test-reports/e2e-reservation-live/evidence/report.png`
- `test-reports/e2e-reservation-live/artifacts/`: real-reservation-confirmed.png and
  real-reservation-conflict.png inside the test's directory; failure screenshots/video
  are retained for unsuccessful runs. Authentication traces remain disabled.

The command is opt-in and must not replace default `npm test` in shared CI. The team
lead can collect the separate JUnit/HTML paths after explicitly provisioning these
local services. No shared workflow was changed and live GitHub Actions execution is
not verified. This test does not verify Kafka delivery, orders, payments, Azure storage,
email delivery or every reservation lifecycle operation. It uses the application's
existing behavior: a successful confirmation UI corresponds to a Pending database row.
