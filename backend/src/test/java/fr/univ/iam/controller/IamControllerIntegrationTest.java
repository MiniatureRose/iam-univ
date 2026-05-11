package fr.univ.iam.controller;

import fr.univ.iam.domain.*;
import fr.univ.iam.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * Tests d'intégration avec RestTemplate + HTTP Basic Auth réelle.
 *
 * Comptes seedés par DataInitializer :
 * admin@univ.fr → ADMIN (password: password)
 * pierre.durand@univ-paris13.fr → CONFIGURATOR
 * achraf.jdidi@univ-paris13.fr → USER
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@DisplayName("IamController – Tests d'intégration")
class IamControllerIntegrationTest {

    @LocalServerPort
    int port;

    @Autowired
    IdentityRepository identityRepo;
    @Autowired
    StatusRepository statusRepo;
    @Autowired
    GroupRepository groupRepo;
    @Autowired
    RoleRepository roleRepo;
    @Autowired
    RoleAssignmentRepository assignmentRepo;
    @Autowired
    PasswordEncoder passwordEncoder;

    // ─── Helpers ───────────────────────────────────────────────

    private String url(String path) {
        return "http://localhost:" + port + "/api/v1" + path;
    }

    /**
     * Authentifie via POST /auth/login (session), retourne un RestTemplate
     * qui envoie le cookie JSESSIONID sur chaque requête suivante.
     * Utilise Apache HttpClient 5 pour supporter PATCH.
     */
    private RestTemplate client(String email, String password) {
        RestTemplate bootstrap = new RestTemplate(new HttpComponentsClientHttpRequestFactory());
        HttpHeaders loginHeaders = new HttpHeaders();
        loginHeaders.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> loginResp = bootstrap.postForEntity(
                "http://localhost:" + port + "/api/v1/auth/login",
                new HttpEntity<>(Map.of("email", email, "password", password), loginHeaders),
                Map.class);
        List<String> setCookies = loginResp.getHeaders().get(HttpHeaders.SET_COOKIE);
        String sessionCookie = setCookies != null ? String.join("; ", setCookies) : "";

        RestTemplate rt = new RestTemplate(new HttpComponentsClientHttpRequestFactory());
        final String cookie = sessionCookie;
        rt.getInterceptors().add((req, body, execution) -> {
            if (!cookie.isEmpty()) req.getHeaders().set(HttpHeaders.COOKIE, cookie);
            req.getHeaders().setAccept(List.of(MediaType.APPLICATION_JSON));
            return execution.execute(req, body);
        });
        return rt;
    }

    private RestTemplate asAdmin() {
        return client("admin@univ.fr", "password");
    }

    private RestTemplate asConfigurator() {
        return client("pierre.durand@univ-paris13.fr", "password");
    }

    private RestTemplate asUser() {
        return client("achraf.jdidi@univ-paris13.fr", "password");
    }

    /** Construit une HttpEntity JSON */
    private <T> HttpEntity<T> json(T body) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }

    // ─── Helpers de création directe en base ──────────────────

    private Identity saveIdentity(String first, String last, String email, AppRole role) {
        Identity i = new Identity();
        i.setFirstName(first);
        i.setLastName(last);
        i.setPrimaryEmail(email);
        i.setAppRole(role);
        i.setPassword(passwordEncoder.encode("password"));
        i.setMustChangePassword(false);
        return identityRepo.save(i);
    }

    private Status saveStatus(String name) {
        Status s = new Status();
        s.setName(name);
        return statusRepo.save(s);
    }

    private Group saveGroup(String name) {
        Group g = new Group();
        g.setName(name);
        return groupRepo.save(g);
    }

    private Role saveRole(String name, Group group) {
        Role r = new Role();
        r.setName(name);
        r.setGroup(group);
        return roleRepo.save(r);
    }

    // ═══════════════════════════════════════════════════════════
    // SÉCURITÉ
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Sécurité – contrôle d'accès")
    class SecurityTests {

        @Test
        @DisplayName("❌ GET /identities sans auth → 401")
        void shouldReturn401WithNoAuth() {
            RestTemplate anonymous = new RestTemplate();
            assertThatThrownBy(() -> anonymous.getForEntity(url("/identities"), String.class))
                    .isInstanceOf(HttpClientErrorException.Unauthorized.class);
        }

        @Test
        @DisplayName("❌ POST /identities en tant que USER → 403")
        void shouldReturn403WhenUserCreatesIdentity() {
            assertThatThrownBy(() -> asUser().postForEntity(url("/identities"),
                    json(Map.of("firstName", "X", "lastName", "Y", "email", "x@univ.fr")),
                    String.class))
                    .isInstanceOf(HttpClientErrorException.Forbidden.class);
        }

        @Test
        @DisplayName("❌ DELETE /roles/{id} en tant que CONFIGURATOR → 403")
        void shouldReturn403WhenConfiguratorDeletesRole() {
            assertThatThrownBy(() -> asConfigurator().exchange(
                    url("/roles/" + UUID.randomUUID()),
                    HttpMethod.DELETE, HttpEntity.EMPTY, String.class))
                    .isInstanceOf(HttpClientErrorException.Forbidden.class);
        }

        @Test
        @DisplayName("✅ GET /identities en tant que USER → 200")
        void shouldAllowUserToListIdentities() {
            ResponseEntity<Map> resp = asUser().getForEntity(url("/identities"), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("GET /stats")
    class StatsTests {

        @Test
        @DisplayName("✅ Admin voit les stats avec des valeurs positives")
        void shouldReturnStatsForAdmin() {
            ResponseEntity<Map> resp = asAdmin().getForEntity(url("/stats"), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat((Integer) resp.getBody().get("identities")).isGreaterThan(0);
            assertThat((Integer) resp.getBody().get("groups")).isGreaterThan(0);
            assertThat((Integer) resp.getBody().get("statuses")).isGreaterThan(0);
        }

        @Test
        @DisplayName("✅ Un USER peut aussi consulter les stats")
        void shouldReturnStatsForUser() {
            ResponseEntity<Map> resp = asUser().getForEntity(url("/stats"), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // IDENTITIES
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("CRUD /identities")
    class IdentityTests {

        @Test
        @DisplayName("✅ POST crée une identité")
        void shouldCreateIdentity() {
            ResponseEntity<Map> resp = asAdmin().postForEntity(url("/identities"),
                    json(Map.of("firstName", "Créé", "lastName", "Test", "email", "cree.test.unique@univ.fr")),
                    Map.class);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody().get("temporaryPassword")).isNotNull();
            Map<?, ?> identity = (Map<?, ?>) resp.getBody().get("identity");
            assertThat(identity.get("primaryEmail")).isEqualTo("cree.test.unique@univ.fr");

            // Cleanup
            asAdmin().delete(url("/identities/" + identity.get("id")));
        }

        @Test
        @DisplayName("❌ POST avec email déjà pris → 409")
        void shouldReturn409OnDuplicateEmail() {
            // admin@univ.fr est seedé
            assertThatThrownBy(() -> asAdmin().postForEntity(url("/identities"),
                    json(Map.of("firstName", "D", "lastName", "D", "email", "admin@univ.fr")), Map.class))
                    .isInstanceOf(HttpClientErrorException.Conflict.class);
        }

        @Test
        @DisplayName("✅ GET /identities liste toutes les identités")
        void shouldListAllIdentities() {
            ResponseEntity<Map> resp = asAdmin().getForEntity(url("/identities"), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat((List<?>) resp.getBody().get("content")).hasSizeGreaterThanOrEqualTo(8); // 8 seedées
        }

        @Test
        @DisplayName("✅ GET /identities/{id} retourne la bonne identité")
        void shouldGetIdentityById() {
            Identity existing = identityRepo.findByPrimaryEmail("achraf.jdidi@univ-paris13.fr").orElseThrow();
            ResponseEntity<Map> resp = asAdmin().getForEntity(url("/identities/" + existing.getId()), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody().get("firstName")).isEqualTo("Achraf");
        }

        @Test
        @DisplayName("✅ GET /identities/snapshots retourne une page")
        void shouldReturnSnapshotPage() {
            ResponseEntity<Map> resp = asAdmin().getForEntity(
                    url("/identities/snapshots?query=Achraf&page=0&size=5"), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody()).containsKey("content");
        }

        @Test
        @DisplayName("✅ PUT /app-role change le rôle système")
        void shouldUpdateAppRole() {
            Identity target = saveIdentity("RoleChange", "Test", "rolechange@univ.fr", AppRole.USER);
            try {
                ResponseEntity<Map> resp = asAdmin().exchange(
                        url("/identities/" + target.getId() + "/app-role"),
                        HttpMethod.PUT,
                        json(Map.of("appRole", "ADMIN")),
                        Map.class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(resp.getBody().get("appRole")).isEqualTo("ADMIN");
            } finally {
                identityRepo.deleteById(target.getId());
            }
        }

        @Test
        @DisplayName("✅ DELETE /identities/{id} supprime l'identité")
        void shouldDeleteIdentity() {
            Identity toDelete = saveIdentity("Del", "Me", "delete.int@univ.fr", AppRole.USER);
            ResponseEntity<Void> resp = asAdmin().exchange(
                    url("/identities/" + toDelete.getId()), HttpMethod.DELETE, HttpEntity.EMPTY, Void.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
            assertThat(identityRepo.findById(toDelete.getId())).isEmpty();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // STATUSES
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("CRUD /statuses")
    class StatusTests {

        @Test
        @DisplayName("✅ GET liste les statuts (≥ 5 seedés)")
        void shouldListStatuses() {
            ResponseEntity<Object[]> resp = asAdmin().getForEntity(url("/statuses"), Object[].class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody()).hasSizeGreaterThanOrEqualTo(5);
        }

        @Test
        @DisplayName("✅ POST crée un statut")
        void shouldCreateStatus() {
            ResponseEntity<Map> resp = asAdmin().postForEntity(url("/statuses"),
                    json(Map.of("name", "StatutIntegration", "description", "Test")), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody().get("name")).isEqualTo("StatutIntegration");
            // Cleanup
            asAdmin().delete(url("/statuses/" + resp.getBody().get("id")));
        }

        @Test
        @DisplayName("✅ PUT assigne un statut à une identité")
        void shouldAssignStatusToIdentity() {
            Identity identity = saveIdentity("Statut", "Assign", "statut.assign@univ.fr", AppRole.USER);
            Status status = saveStatus("StatutAssignTest");
            try {
                ResponseEntity<Map> resp = asAdmin().exchange(
                        url("/identities/" + identity.getId() + "/status"),
                        HttpMethod.PUT,
                        json(Map.of("statusId", status.getId().toString())),
                        Map.class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
                Map<?, ?> s = (Map<?, ?>) resp.getBody().get("status");
                assertThat(s.get("name")).isEqualTo("StatutAssignTest");
            } finally {
                identityRepo.deleteById(identity.getId());
                statusRepo.deleteById(status.getId());
            }
        }

        @Test
        @DisplayName("✅ DELETE supprime un statut")
        void shouldDeleteStatus() {
            Status s = saveStatus("ÀSupprimerInt");
            ResponseEntity<Void> resp = asAdmin().exchange(
                    url("/statuses/" + s.getId()), HttpMethod.DELETE, HttpEntity.EMPTY, Void.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
            assertThat(statusRepo.findById(s.getId())).isEmpty();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // GROUPS
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("CRUD /groups")
    class GroupTests {

        @Test
        @DisplayName("✅ GET liste tous les groupes (≥ 6 seedés)")
        void shouldListGroups() {
            ResponseEntity<Object[]> resp = asAdmin().getForEntity(url("/groups"), Object[].class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody()).hasSizeGreaterThanOrEqualTo(6);
        }

        @Test
        @DisplayName("✅ POST crée un groupe")
        void shouldCreateGroup() {
            ResponseEntity<Map> resp = asAdmin().postForEntity(url("/groups"),
                    json(Map.of("name", "Groupe Intégration")), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody().get("name")).isEqualTo("Groupe Intégration");
            // Cleanup
            asAdmin().delete(url("/groups/" + resp.getBody().get("id")));
        }

        @Test
        @DisplayName("✅ PUT renomme un groupe")
        void shouldRenameGroup() {
            Group g = saveGroup("Nom Original");
            try {
                ResponseEntity<Map> resp = asAdmin().exchange(
                        url("/groups/" + g.getId()), HttpMethod.PUT,
                        json(Map.of("name", "Nom Modifié")), Map.class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(resp.getBody().get("name")).isEqualTo("Nom Modifié");
            } finally {
                groupRepo.deleteById(g.getId());
            }
        }

        @Test
        @DisplayName("✅ DELETE archive le groupe")
        void shouldArchiveGroup() {
            Group g = saveGroup("Groupe Archive");
            try {
                ResponseEntity<Void> resp = asAdmin().exchange(
                        url("/groups/" + g.getId()), HttpMethod.DELETE, HttpEntity.EMPTY, Void.class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
                assertThat(groupRepo.findById(g.getId()).orElseThrow().isActive()).isFalse();
            } finally {
                groupRepo.deleteById(g.getId());
            }
        }

        @Test
        @DisplayName("✅ GET /groups/{id}/members retourne les membres actifs")
        void shouldReturnGroupMembers() {
            Group g = saveGroup("Groupe Membres Int");
            Role r = saveRole("Membre Int", g);
            Identity member = saveIdentity("Membre", "Int", "membre.int@univ.fr", AppRole.USER);
            RoleAssignment ra = new RoleAssignment();
            ra.setIdentity(member);
            ra.setRole(r);
            ra.setStartDate(LocalDate.now().minusDays(1));
            ra = assignmentRepo.save(ra);
            try {
                ResponseEntity<Object[]> resp = asAdmin().getForEntity(
                        url("/groups/" + g.getId() + "/members"), Object[].class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(resp.getBody()).hasSizeGreaterThanOrEqualTo(1);
            } finally {
                assignmentRepo.deleteById(ra.getId());
                identityRepo.deleteById(member.getId());
                roleRepo.deleteById(r.getId());
                groupRepo.deleteById(g.getId());
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("CRUD /roles")
    class RoleTests {

        @Test
        @DisplayName("✅ POST crée un rôle dans un groupe")
        void shouldCreateRole() {
            Group g = saveGroup("Groupe Rôle Int");
            try {
                ResponseEntity<Map> resp = asAdmin().postForEntity(url("/roles"),
                        json(Map.of("name", "Rôle Int", "description", "Test", "groupId", g.getId().toString())),
                        Map.class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
                assertThat(resp.getBody().get("name")).isEqualTo("Rôle Int");
                // Cleanup role
                roleRepo.deleteById(UUID.fromString((String) resp.getBody().get("id")));
            } finally {
                groupRepo.deleteById(g.getId());
            }
        }

        @Test
        @DisplayName("✅ DELETE archive le rôle et clôture ses affectations actives")
        void shouldArchiveRoleAndCloseAssignments() {
            Group g = saveGroup("Groupe Rôle Delete");
            Role r = saveRole("Rôle À Archiver", g);
            Identity id = saveIdentity("Archive", "Role", "archive.role@univ.fr", AppRole.USER);
            RoleAssignment ra = new RoleAssignment();
            ra.setIdentity(id);
            ra.setRole(r);
            ra.setStartDate(LocalDate.now().minusDays(5));
            ra = assignmentRepo.save(ra);
            UUID raId = ra.getId();
            try {
                ResponseEntity<Void> resp = asAdmin().exchange(
                        url("/roles/" + r.getId()), HttpMethod.DELETE, HttpEntity.EMPTY, Void.class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
                assertThat(roleRepo.findById(r.getId()).orElseThrow().isActive()).isFalse();
                assertThat(assignmentRepo.findById(raId).orElseThrow().getEndDate())
                        .isEqualTo(LocalDate.now());
            } finally {
                // Respecter l'ordre FK : assignments → identity → role → group
                assignmentRepo.deleteById(raId);
                identityRepo.deleteById(id.getId());
                roleRepo.deleteById(r.getId());
                groupRepo.deleteById(g.getId());
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ASSIGNMENTS
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Affectations de rôles")
    class AssignmentTests {

        @Test
        @DisplayName("✅ POST assigne un rôle à une identité")
        void shouldAssignRole() {
            Group g = saveGroup("Groupe Assign Int");
            Role r = saveRole("Rôle Assign Int", g);
            Identity id = saveIdentity("Assign", "Int", "assign.int@univ.fr", AppRole.USER);
            try {
                ResponseEntity<Map> resp = asAdmin().postForEntity(
                        url("/identities/" + id.getId() + "/assignments/roles"),
                        json(Map.of("roleId", r.getId().toString(), "startDate", LocalDate.now().toString())),
                        Map.class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
                Map<?, ?> roleMap = (Map<?, ?>) resp.getBody().get("role");
                assertThat(roleMap.get("name")).isEqualTo("Rôle Assign Int");
                // Cleanup assignment
                assignmentRepo.deleteById(UUID.fromString((String) resp.getBody().get("id")));
            } finally {
                identityRepo.deleteById(id.getId());
                roleRepo.deleteById(r.getId());
                groupRepo.deleteById(g.getId());
            }
        }

        @Test
        @DisplayName("✅ GET /identities/{id}/timeline retourne l'historique")
        void shouldReturnTimeline() {
            Identity id = identityRepo.findByPrimaryEmail("achraf.jdidi@univ-paris13.fr").orElseThrow();
            ResponseEntity<Map> resp = asAdmin().getForEntity(
                    url("/identities/" + id.getId() + "/timeline"), Map.class);
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody()).containsKey("identity");
            assertThat(resp.getBody()).containsKey("roles");
        }

        @Test
        @DisplayName("✅ PATCH /terminate clôture l'affectation")
        void shouldTerminateAssignment() {
            Group g = saveGroup("Groupe Terminate Int");
            Role r = saveRole("Rôle Terminate Int", g);
            Identity id = saveIdentity("Terminate", "Int", "terminate.int@univ.fr", AppRole.USER);
            RoleAssignment ra = new RoleAssignment();
            ra.setIdentity(id);
            ra.setRole(r);
            ra.setStartDate(LocalDate.now().minusDays(10));
            ra = assignmentRepo.save(ra);
            try {
                ResponseEntity<Void> resp = asAdmin().exchange(
                        url("/assignments/roles/" + ra.getId() + "/terminate"),
                        HttpMethod.PATCH, HttpEntity.EMPTY, Void.class);
                assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
                assertThat(assignmentRepo.findById(ra.getId()).orElseThrow().getEndDate()).isNotNull();
            } finally {
                assignmentRepo.deleteById(ra.getId());
                identityRepo.deleteById(id.getId());
                roleRepo.deleteById(r.getId());
                groupRepo.deleteById(g.getId());
            }
        }
    }
}
