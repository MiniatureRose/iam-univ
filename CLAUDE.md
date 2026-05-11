# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Sovereign IAM

Educational project: a university Identity & Access Management (IAM) system for Paris 13 University. Bilingual codebase (French domain logic + English code). Spring Boot + React 19 full-stack, H2 in-memory DB, no persistence between runs.

---

## Commands

### Backend (Maven)

```bash
cd backend

# Build
./mvnw clean package

# Run (localhost:8080)
./mvnw spring-boot:run

# Run all tests
./mvnw test

# Run a single test class
./mvnw test -Dtest=IamServiceTest
./mvnw test -Dtest=AssignmentValidationServiceTest
./mvnw test -Dtest=IamControllerIntegrationTest
```

OpenAPI docs: `http://localhost:8080/swagger-ui.html`  
H2 console (dev only): `http://localhost:8080/h2-console` (user `sa`, empty password)

### Frontend (Vite)

```bash
cd frontend

npm install          # install dependencies
npm run dev          # dev server (localhost:5173, hot reload)
npm run build        # production build
npm run preview      # serve production build
npm run lint         # lint JavaScript/JSX
```

**Frontend expects backend on `http://localhost:8080`.** Auth uses HTTP Basic encoded in `localStorage` as `iam_auth_token`.

---

## Architecture

### Data Model: Five Linked Entities

Core domain model (`backend/src/main/java/fr/univ/iam/domain/`) — JPA entities with in-memory H2:

```
Identity (user accounts)
  ├─ status: Status (contractual: BIATSS, Enseignant-Chercheur, Doctorant, etc.)
  ├─ appRole: enum (ADMIN, CONFIGURATOR, USER)
  ├─ password: String (stored as {noop} plaintext — critical security debt)
  └─ roleAssignments: List<RoleAssignment> (effective-dated assignments)

RoleAssignment (temporal binding)
  ├─ startDate: LocalDate
  ├─ endDate: LocalDate (null = ongoing)
  ├─ identity: Identity
  └─ role: Role

Role (business role, scoped to group)
  ├─ name, description
  ├─ active: boolean (soft-delete flag)
  └─ group: Group

Group (organizational hierarchy)
  ├─ name, active
  ├─ parent: Group (self-referential hierarchy)
  ├─ configurators: Set<Identity> (users who can manage this group)
  └─ subGroups: List<Group>

Status (lookup table for contractual relationships)
  └─ name, description (reference data)
```

**Key pattern: Effective-dated role assignments.** An identity can hold the same role across multiple date ranges. `AssignmentValidationService` prevents duplicate assignments starting on the same date. When terminating a role assignment without an explicit end date, `IamService.terminateRole()` sets `endDate = LocalDate.now().minusDays(1)` (yesterday, not today).

### Authorization Model: Three Tiers

Hierarchy enforced via `@PreAuthorize` + `AuthorizationService` (`backend/src/main/java/fr/univ/iam/security/`):

- **ADMIN** — unrestricted CRUD on all resources; only role that can change `appRole`
- **CONFIGURATOR** — limited to groups they are listed as `configurators` for; can assign/terminate roles within those groups
- **USER** — read-only annuaire (directory), view own profile

**Critical flow:** When a USER is added as a group `configurator`, they are auto-promoted to CONFIGURATOR (`IamService.java:165,206`). Removing the last configurator from a group throws `IllegalStateException`.

### API Endpoints

**Authentication** (`/api/v1/auth`)
```
GET /auth/me  — returns Identity of authenticated user (or 401)
```

**CRUD Resources** (`/api/v1`)
```
GET  /stats                            — counts: identities, groups, statuses (any role)
/identities                            — list (filter by appRoles), get, create (ADMIN/CONFIGURATOR), delete (ADMIN)
/identities/{id}/app-role              — update appRole (ADMIN only)
/identities/{id}/timeline              — historical snapshot at date
/identities/snapshots                  — paginated search snapshots at date
/roles, /statuses, /groups             — standard CRUD with role checks
```

**Relational Operations**
```
POST   /identities/{id}/assignments/roles     — assign role (ADMIN or CONFIGURATOR of role's group)
PUT    /identities/{id}/status                — assign status (ADMIN only)
GET    /groups/{id}/members                   — list members with role at date
GET/POST/DELETE /groups/{id}/configurators    — manage configurators
PATCH  /assignments/roles/{id}/terminate      — end a role assignment early
```

### Frontend State & Routing

Single-page app (`frontend/src/App.jsx`) with client-side state machine (no react-router):

```javascript
const [tab, setTab] = useState('identities');
const [selectedId, setSelectedId] = useState(null);
const [currentUser, setCurrentUser] = useState(null);
```

**Tab routing by `appRole`:**
- ADMIN: `admin` (AdminPage) + `groups` (GroupsPage) + `portal` (UserPortal)
- CONFIGURATOR: `groups` + `identities` + `portal`
- USER: `identities` + `portal`

**Data flow:** App loads → checks `localStorage.iam_auth_token` → calls `/auth/me` → hydrates `currentUser`. All API calls go through `frontend/src/services/api.js` (injects Basic Auth, handles 401 redirects).

**Shared utilities** (`frontend/src/utils/index.js`): `isActive(assignment)` (checks `endDate` and `role.active`), `fmtDate(d)` (French locale), `getColor(name)` (deterministic color from string hash).

### Timeline / Effective Dating

`IdentityTimelineService` computes snapshots by filtering `RoleAssignment` where `startDate <= targetDate && (endDate == null || endDate >= targetDate)`. `/identities/snapshots` is paginated and queryable by name.

### Soft-Delete Pattern

Deleting a group, role, or status: set `active = false` and terminate all active role assignments (`endDate = today`). Hard delete is only used for `Identity` (ADMIN) and `Status`.

---

## Test Suite

Three active test classes (all in `backend/src/test/`):

| Class | Type | What it covers |
|---|---|---|
| `IamServiceTest` | Unit (Mockito) | createIdentity, updateAppRole, role/status/group CRUD, assignment lifecycle |
| `AssignmentValidationServiceTest` | Unit (Mockito) | overlap detection, date range validation |
| `IamControllerIntegrationTest` | Integration (real HTTP, H2) | security access control, all CRUD endpoints, assignments, timeline |

Integration tests use `@SpringBootTest(webEnvironment = RANDOM_PORT)` + `RestTemplate` backed by Apache HttpClient 5 (required for PATCH support — the default `HttpURLConnection` rejects PATCH). Tests use seeded demo accounts (`admin@univ.fr`, `pierre.durand@univ-paris13.fr`, `achraf.jdidi@univ-paris13.fr`).

---

## Development Workflow

### Adding an Endpoint

1. Define entity in `domain/` if needed (JPA `@Entity`; repositories auto-generate)
2. Add repository in `repository/` (extend `JpaRepository<T, UUID>`)
3. Implement logic in `service/` (`@Transactional` if mutating)
4. Expose in `controller/IamController.java` with `@PreAuthorize` guard
5. Call from frontend via `api.js` with async/await + toast error handling

### Adding a Frontend Page

1. Create component in `frontend/src/pages/`
2. Import in `App.jsx` and add to the conditional render tree
3. Add tab key and nav item if top-level
4. Use `currentUser.appRole` prop for UI gating (server `@PreAuthorize` is authoritative)

---

## Known Issues & Constraints

### Critical Security Debt (see DETTE_TECHNIQUE.md)

- **Passwords stored plaintext:** `{noop}` prefix in `Identity.password`; needs `BCryptPasswordEncoder`
- **Password in API responses:** `Identity` entity returned directly; create `IdentityDto` record without `password`
- **CSRF disabled** and **H2 console enabled** — acceptable for dev only
- **CORS hardcoded** to `localhost:5173` / `127.0.0.1:5173` in `SecurityConfig.corsConfigurationSource()`

### Design Constraints

- **No persistence:** H2 in-memory; `DataInitializer` reloads demo fixtures on startup when DB is empty
- **No schema migrations:** `spring.jpa.hibernate.ddl-auto=update`; auto-evolves schema
- **No TypeScript:** Frontend is plain JavaScript

---

## Demo Data

All default password: `password`

| Email | Role | Notes |
|---|---|---|
| `admin@univ.fr` | ADMIN | |
| `pierre.durand@univ-paris13.fr` | CONFIGURATOR | Chef de Département, IUT |
| `achraf.jdidi@univ-paris13.fr` | USER | Ingénieur Informatique, DSI |
| `sophie.martin@univ-paris13.fr` | USER | Maître de Conférences, LIPN |
| `amina.benali@univ-paris13.fr` | USER | Professeur, UFR Sciences |

**Groups:** DSI, DRI, IUT, UFR Sciences, LIPN, Service RH  
**Statuses:** BIATSS, Enseignant-Chercheur, Doctorant, Chercheur Invité, Étudiant

---

## Notes for Maintainers

- **Bilingual codebase:** French domain terms and error messages in backend, French UI in frontend. Preserve for institutional stakeholders.
- **Educational context:** Some queries are N+1 (e.g., `IamController.getGroupMembers`). OK for demo.
- **Effective dating is core:** Don't refactor role assignment logic without understanding the temporal dimension.
- **Authorization is centralized:** All permission checks go through `AuthorizationService` or `@PreAuthorize`. Don't bypass with private methods.
