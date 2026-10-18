# Unit Testing & Mocking (xUnit + Moq) - Individual Area 3

Owner: Perera H.L.P.S. (IT24101848) - SE3112 Advanced Software Engineering.

`CinnamonBistro.UnitTests` is a stand-alone xUnit project that exercises the **real** classes of the Cinnamon Bistro CSP
`identity-service` and `reservation-service` (referenced as projects). Database / Kafka dependencies are isolated behind the
application's own interfaces and replaced with Moq mocks, so **no MySQL or Kafka is required**.

> These tests are **new and separate** from the ~570 upstream CSP tests (`tests/unit/*` in the application repo), which are
> neither copied nor counted here. Count for this suite: see "Latest verified result".

## Prerequisites

- .NET SDK 10 (`dotnet --version` -> 10.x)
- The application under test checked out read-only. Local default is a sibling clone:

```powershell
git clone -b develop https://github.com/Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System.git ../Cinnamon-Bistro-CSP-Reference
```

## Application path (`TargetAppRoot`)

The project references `$(TargetAppRoot)/backend/{identity-service,reservation-service}/*.csproj`.
Default: `../../Cinnamon-Bistro-CSP-Reference` relative to `unit-tests/`. Override for any other layout (e.g. CI):

```bash
dotnet test unit-tests/CinnamonBistro.UnitTests.csproj -p:TargetAppRoot=../target-app
```

No drive letters or absolute paths are committed. Both the default sibling layout and the `-p:TargetAppRoot=../target-app`
layout were verified locally on Windows.

## Commands

Run from the repository root (PowerShell, single line):

```powershell
dotnet restore unit-tests/CinnamonBistro.UnitTests.csproj
dotnet test unit-tests/CinnamonBistro.UnitTests.csproj --configuration Release --logger "trx;LogFileName=unit-test-results.trx" --results-directory test-reports/unit --collect:"XPlat Code Coverage"
```

**CI one-liner (ubuntu-latest, .NET 10, app checked out at `target-app/`):**

```bash
dotnet test unit-tests/CinnamonBistro.UnitTests.csproj --configuration Release -p:TargetAppRoot=../target-app --logger "trx;LogFileName=unit-test-results.trx" --results-directory test-reports/unit --collect:"XPlat Code Coverage"
```

Outputs (git-ignored): `test-reports/unit/unit-test-results.trx` and
`test-reports/unit/<guid>/coverage.cobertura.xml` (coverlet writes the Cobertura file into a GUID sub-folder).
The command exits non-zero when any assertion fails.

## Test case list

| Area | File | Unit under test | What is covered |
|---|---|---|---|
| Authentication | `Authentication/AuthServiceLoginTests.cs` | `AuthService.LoginAsync` | valid login -> token/claims/expiry; email trimmed; unknown email; wrong password (same message as unknown email); blocked account; inactive / soft-deleted / `Inactive` status (Theory); case-insensitive `Blocked`; disabled account still an `UnauthorizedAccessException` |
| Authentication | `Authentication/AuthServiceRegisterTests.cs` | `AuthService.RegisterAsync` | normalised user persisted + password hashed; blank role defaults to Customer (Theory); staff roles with correct code (Theory); missing/wrong staff code (Theory); email validator rejection; duplicate email |
| Authentication | `Authentication/JwtTokenGeneratorTests.cs` | `JwtTokenGenerator.GenerateToken` | signed token decodes and validates; one role claim per role; no roles; distinct `jti`; configured expiry 1/15/1440 min and fallback to 60 (Theory); token rejected with a different key; null roles characterisation |
| Reservation validation | `Reservation/AvailabilitySearchValidatorTests.cs` | `AvailabilitySearchValidator.TryValidate` | valid slot and computed end; boundaries (open 10:00, close 22:00, 30/240 min, start == now); guests 0/-1/min (Theory); duration 0/-30 and 29/241/1000 (Theory); outside hours + midnight crossing (Theory); past date / past time; restaurant time zone (Asia/Colombo); calendar overflow; null request; multiple errors; bad time zone / bad opening-time config |
| Reservation validation | `Reservation/ReservationPoliciesTests.cs` | `ReservationOverlapPolicy.Blocks`, `ReservationStatusTransitionPolicy.IsAllowed` | half-open interval boundaries (11 cases); only Pending/Confirmed block; allowed vs rejected lifecycle transitions; terminal states |
| Reservation validation | `Reservation/ReservationCreationServiceTests.cs` | `ReservationCreationService.CreateAsync` | delegation with exact command + cancellation token; `Replayed`/`TableNotFound`/`Unavailable` outcomes propagated; repository exception not swallowed |
| Pricing / totals | `Pricing/OrderCartItemSubtotalTests.cs` | `OrderCartItem.Subtotal` | exact decimal arithmetic (e.g. 0.10 x 3 = 0.30); free item; zero / negative quantity; no rounding (characterisation); recompute on change |
| Pricing / totals | `Pricing/OrderCartServiceTests.cs` | `OrderCartService` | add/update/remove/clear; quantity 1..99 boundaries; 90+9 ok / 90+10 rejected; non-positive ids; missing / unavailable menu item; repository failure; empty cart is not cleared in the repository |
| Authorization | `Authorization/RoleAuthorizationTests.cs` | `[Authorize]` metadata of real controllers | allowed role accepted; wrong role, unauthenticated and role-less users rejected; case-sensitive roles; staff controllers use `RequireStaff`; role-name contract between services |

**Moq `Setup` + `Verify`:** e.g. `LoginAsync_ValidCredentials_ReturnsTokenAndUserClaims` verifies `GenerateToken` ran exactly once with the
user's roles; the failure-path tests verify `GenerateToken`/`VerifyPassword` were **never** called; register tests verify the exact
`User` handed to `CreateUserWithRoleAsync` (`It.Is<User>(...)`).

## Design notes

- Arrange-Act-Assert; the unit under test is always the real class, only collaborators are mocked.
- Determinism: a hand-made `FixedTimeProvider` replaces the clock; no `Thread.Sleep`, no random values, no real network/payment calls.
  JWT expiry is asserted against a `before/after` window because the production code reads `DateTime.UtcNow` directly.
- Exception tests assert the exception type and a distinctive message fragment, not whole sentences (exception: the intentionally
  shared "Invalid email or password." message, which is a security property).

## Assumptions

- Test targets were chosen from the real source on application `develop` (commit `ee41765` at time of writing); constructors,
  interfaces and messages were read, not assumed.
- The application repository is read-only; nothing in it is modified.

## Limitations

- **No discount or rounding logic exists in the application**, so "pricing" tests cover `OrderCartItem.Subtotal`
  (UnitPrice x Quantity, exact decimals) and `OrderCartService` quantity rules. Order totals in `OrdersController` /
  `ReservationPreOrdersController` are computed inside DB-backed controller code and are not unit-tested.
- **Over capacity**: the validator has no upper guest limit and capacity is enforced by SQL in the repository; the
  unit suite verifies only that an `Unavailable` outcome is propagated. Real capacity enforcement needs an integration test.
- **Authorization**: policies are registered in `Program.cs` and cannot be evaluated without a host; policy-protected controllers are
  checked by policy name only. `[Authorize(Roles=...)]` semantics are evaluated by a small helper in the test that mirrors ASP.NET's rule.
- `JwtTokenGenerator.GenerateToken` does not defensively validate null roles (it fails incidentally with `NullReferenceException`);
  the test documents this behaviour.
- `reservation-service` exposes internals only to its own test assembly, so only public types are tested.
- Time-zone tests use `Asia/Colombo`; the runner needs tzdata (present on `ubuntu-latest`). Not yet executed on Linux.
- Coverage is collected for the whole referenced services; the percentage is low by design because only the selected units are targeted.
  The lead owns coverage gating.

## Latest verified result

Windows 11, .NET SDK 10.0.401, Release: **Passed 156, Failed 0, Skipped 0** (command above, exit code 0).
