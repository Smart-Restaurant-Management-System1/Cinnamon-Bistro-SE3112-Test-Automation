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
Public validation/navigation tests require no API responses. There are no real API tests in this suite.

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

## Full-stack limitations and team-lead handoff

The application has .NET 10 identity/reservation services with MySQL 8 and Kafka.
Docker CLI is installed locally, but `com.docker.service` and `MySQL80` are stopped;
`docker info` cannot connect because the Docker named pipe is absent. No isolated
database/seeded test accounts were supplied. A real backend journey is therefore
unverified. Mocked success is not evidence of database or cross-service correctness.

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
