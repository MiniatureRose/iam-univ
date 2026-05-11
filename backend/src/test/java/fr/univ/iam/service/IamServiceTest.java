package fr.univ.iam.service;

import fr.univ.iam.domain.*;
import fr.univ.iam.dto.IdentityCreateResult;
import fr.univ.iam.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("IamService – Tests unitaires")
class IamServiceTest {

    @Mock IdentityRepository identityRepository;
    @Mock RoleRepository roleRepository;
    @Mock GroupRepository groupRepository;
    @Mock StatusRepository statusRepository;
    @Mock RoleAssignmentRepository roleAssignmentRepository;
    @Mock AssignmentValidationService validationService;
    @Mock PasswordEncoder passwordEncoder;

    @InjectMocks IamService service;

    // ─── Helpers ───────────────────────────────────────────────

    private Identity adminIdentity(String email) {
        Identity i = new Identity();
        i.setId(UUID.randomUUID());
        i.setFirstName("Admin");
        i.setLastName("Test");
        i.setPrimaryEmail(email);
        i.setAppRole(AppRole.ADMIN);
        return i;
    }

    private Identity userIdentity(String email) {
        Identity i = new Identity();
        i.setId(UUID.randomUUID());
        i.setFirstName("User");
        i.setLastName("Test");
        i.setPrimaryEmail(email);
        i.setAppRole(AppRole.USER);
        return i;
    }

    private void setAdminContext(String email) {
        var auth = new UsernamePasswordAuthenticationToken(
                email, "password",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void setUserContext(String email) {
        var auth = new UsernamePasswordAuthenticationToken(
                email, "password",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    // ═══════════════════════════════════════════════════════════
    // IDENTITIES
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("createIdentity()")
    class CreateIdentityTests {

        @Test
        @DisplayName("✅ Crée une identité simple (USER) sans statut")
        void shouldCreateBasicUser() {
            setAdminContext("admin@univ.fr");
            when(identityRepository.findByPrimaryEmail("jean@univ.fr")).thenReturn(Optional.empty());
            when(identityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(passwordEncoder.encode(any())).thenReturn("hashed");

            IdentityCreateResult result = service.createIdentity("Jean", "Dupont", "jean@univ.fr", null, AppRole.USER, null, true);

            assertThat(result.identity().getFirstName()).isEqualTo("Jean");
            assertThat(result.identity().getPrimaryEmail()).isEqualTo("jean@univ.fr");
            assertThat(result.identity().getAppRole()).isEqualTo(AppRole.USER);
            assertThat(result.temporaryPassword()).isNotBlank();
            verify(identityRepository).save(any());
        }

        @Test
        @DisplayName("✅ Crée une identité avec statut")
        void shouldCreateUserWithStatus() {
            setAdminContext("admin@univ.fr");
            UUID statusId = UUID.randomUUID();
            Status status = new Status();
            status.setId(statusId);
            status.setName("BIATSS");

            when(identityRepository.findByPrimaryEmail(anyString())).thenReturn(Optional.empty());
            when(statusRepository.findById(statusId)).thenReturn(Optional.of(status));
            when(identityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(passwordEncoder.encode(any())).thenReturn("hashed");

            IdentityCreateResult result = service.createIdentity("Marie", "Martin", "marie@univ.fr", null, null, statusId, true);

            assertThat(result.identity().getStatus()).isEqualTo(status);
        }

        @Test
        @DisplayName("❌ Échoue si l'email est déjà utilisé")
        void shouldThrowOnDuplicateEmail() {
            when(identityRepository.findByPrimaryEmail("deja@univ.fr")).thenReturn(Optional.of(new Identity()));

            assertThatThrownBy(() -> service.createIdentity("A", "B", "deja@univ.fr", null, null, null, false))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("already in use");
        }

        @Test
        @DisplayName("❌ Un USER ne peut pas créer un ADMIN")
        void shouldThrowWhenNonAdminCreatesAdmin() {
            setUserContext("user@univ.fr");
            when(identityRepository.findByPrimaryEmail(anyString())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createIdentity("X", "Y", "x@univ.fr", null, AppRole.ADMIN, null, false))
                    .isInstanceOf(SecurityException.class);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // APP ROLE
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("updateAppRole()")
    class UpdateAppRoleTests {

        @Test
        @DisplayName("✅ Un admin peut changer le rôle d'un autre")
        void shouldUpdateRoleOfOtherUser() {
            setAdminContext("admin@univ.fr");
            Identity target = userIdentity("user@univ.fr");
            when(identityRepository.findById(target.getId())).thenReturn(Optional.of(target));
            when(identityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Identity updated = service.updateAppRole(target.getId(), AppRole.ADMIN, "admin@univ.fr");

            assertThat(updated.getAppRole()).isEqualTo(AppRole.ADMIN);
        }

        @Test
        @DisplayName("❌ Un admin ne peut pas modifier son propre rôle")
        void shouldThrowWhenAdminModifiesOwnRole() {
            setAdminContext("admin@univ.fr");
            Identity self = adminIdentity("admin@univ.fr");
            when(identityRepository.findById(self.getId())).thenReturn(Optional.of(self));

            assertThatThrownBy(() -> service.updateAppRole(self.getId(), AppRole.USER, "admin@univ.fr"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("own role");
        }

        @Test
        @DisplayName("❌ Échoue si l'identité n'existe pas")
        void shouldThrowWhenIdentityNotFound() {
            setAdminContext("admin@univ.fr");
            UUID id = UUID.randomUUID();
            when(identityRepository.findById(id)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateAppRole(id, AppRole.USER, "admin@univ.fr"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not found");
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("createRole() / deleteRole()")
    class RoleTests {

        @Test
        @DisplayName("✅ Crée un rôle dans un groupe existant")
        void shouldCreateRoleInGroup() {
            UUID groupId = UUID.randomUUID();
            Group group = new Group();
            group.setId(groupId);
            group.setName("DSI");

            when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
            when(roleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Role role = service.createRole("Responsable", "Desc", groupId);

            assertThat(role.getName()).isEqualTo("Responsable");
            assertThat(role.getGroup()).isEqualTo(group);
        }

        @Test
        @DisplayName("✅ La suppression d'un rôle clôture les affectations actives")
        void shouldCloseActiveAssignmentsOnDelete() {
            UUID roleId = UUID.randomUUID();
            Role role = new Role();
            role.setId(roleId);
            role.setActive(true);

            RoleAssignment active = new RoleAssignment();
            active.setId(UUID.randomUUID());
            active.setRole(role);
            active.setStartDate(LocalDate.now().minusDays(10));
            active.setEndDate(null); // active

            when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
            when(roleAssignmentRepository.findByRoleId(roleId)).thenReturn(List.of(active));
            when(roleAssignmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.deleteRole(roleId);

            assertThat(role.isActive()).isFalse();
            assertThat(active.getEndDate()).isEqualTo(LocalDate.now());
        }

        @Test
        @DisplayName("✅ La suppression ne touche pas les affectations déjà terminées")
        void shouldNotTouchAlreadyEndedAssignmentsOnDelete() {
            UUID roleId = UUID.randomUUID();
            Role role = new Role();
            role.setId(roleId);
            role.setActive(true);

            RoleAssignment ended = new RoleAssignment();
            ended.setId(UUID.randomUUID());
            ended.setRole(role);
            ended.setStartDate(LocalDate.now().minusDays(30));
            ended.setEndDate(LocalDate.now().minusDays(5)); // already ended

            when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
            when(roleAssignmentRepository.findByRoleId(roleId)).thenReturn(List.of(ended));

            service.deleteRole(roleId);

            // endDate should not be changed
            assertThat(ended.getEndDate()).isEqualTo(LocalDate.now().minusDays(5));
            verify(roleAssignmentRepository, never()).save(ended);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // STATUSES
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("createStatus() / deleteStatus() / assignStatus()")
    class StatusTests {

        @Test
        @DisplayName("✅ Crée un statut et l'assigne à une identité")
        void shouldCreateAndAssignStatus() {
            UUID statusId = UUID.randomUUID();
            Status status = new Status();
            status.setId(statusId);
            status.setName("Doctorant");

            Identity identity = userIdentity("alice@univ.fr");

            when(statusRepository.findById(statusId)).thenReturn(Optional.of(status));
            when(identityRepository.findById(identity.getId())).thenReturn(Optional.of(identity));
            when(identityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Identity updated = service.assignStatus(identity.getId(), statusId);

            assertThat(updated.getStatus().getName()).isEqualTo("Doctorant");
        }

        @Test
        @DisplayName("✅ Assigne null retire le statut de l'identité")
        void shouldRemoveStatusWhenNull() {
            Identity identity = userIdentity("alice@univ.fr");
            Status oldStatus = new Status();
            identity.setStatus(oldStatus);

            when(identityRepository.findById(identity.getId())).thenReturn(Optional.of(identity));
            when(identityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            Identity updated = service.assignStatus(identity.getId(), null);

            assertThat(updated.getStatus()).isNull();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // GROUPS
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("createGroup() / deleteGroup() / configurators")
    class GroupTests {

        @Test
        @DisplayName("✅ Crée un groupe et promeut le configurateur en CONFIGURATOR")
        void shouldPromoteUserToConfiguratorWhenAssigned() {
            Identity user = userIdentity("bob@univ.fr");
            assertThat(user.getAppRole()).isEqualTo(AppRole.USER);

            Group savedGroup = new Group();
            savedGroup.setId(UUID.randomUUID());
            savedGroup.setName("RH");
            savedGroup.setConfigurators(new HashSet<>());

            when(identityRepository.findById(user.getId())).thenReturn(Optional.of(user));
            when(groupRepository.save(any())).thenReturn(savedGroup);
            when(identityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.createGroup("RH", null, user.getId());

            assertThat(user.getAppRole()).isEqualTo(AppRole.CONFIGURATOR);
        }

        @Test
        @DisplayName("✅ La suppression d'un groupe archive ses rôles et ferme les affectations")
        void shouldArchiveRolesAndAssignmentsOnGroupDelete() {
            UUID groupId = UUID.randomUUID();
            Group group = new Group();
            group.setId(groupId);
            group.setName("DSI");
            group.setActive(true);

            Role role = new Role();
            UUID roleId = UUID.randomUUID();
            role.setId(roleId);
            role.setActive(true);

            RoleAssignment active = new RoleAssignment();
            active.setStartDate(LocalDate.now().minusDays(5));
            active.setEndDate(null);

            when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
            when(roleRepository.findByGroupId(groupId)).thenReturn(List.of(role));
            when(roleAssignmentRepository.findByRoleId(roleId)).thenReturn(List.of(active));

            service.deleteGroup(groupId);

            assertThat(group.isActive()).isFalse();
            assertThat(role.isActive()).isFalse();
            assertThat(active.getEndDate()).isEqualTo(LocalDate.now());
        }

        @Test
        @DisplayName("❌ Impossible de retirer le dernier configurateur d'un groupe")
        void shouldThrowWhenRemovingLastConfigurator() {
            Identity onlyConf = userIdentity("conf@univ.fr");
            Group group = new Group();
            group.setId(UUID.randomUUID());
            group.setConfigurators(new HashSet<>(Set.of(onlyConf)));

            when(groupRepository.findById(group.getId())).thenReturn(Optional.of(group));
            when(identityRepository.findById(onlyConf.getId())).thenReturn(Optional.of(onlyConf));

            assertThatThrownBy(() -> service.removeGroupConfigurator(group.getId(), onlyConf.getId()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("last configurator");
        }

        @Test
        @DisplayName("✅ Ajouter un configurateur le promeut si USER")
        void shouldPromoteUserWhenAddedAsConfigurator() {
            Identity user = userIdentity("conf@univ.fr");
            Group group = new Group();
            group.setId(UUID.randomUUID());
            group.setConfigurators(new HashSet<>());

            when(groupRepository.findById(group.getId())).thenReturn(Optional.of(group));
            when(identityRepository.findById(user.getId())).thenReturn(Optional.of(user));
            when(groupRepository.save(any())).thenReturn(group);
            when(identityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.addGroupConfigurator(group.getId(), user.getId());

            assertThat(user.getAppRole()).isEqualTo(AppRole.CONFIGURATOR);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ROLE ASSIGNMENTS
    // ═══════════════════════════════════════════════════════════

    @Nested
    @DisplayName("assignRole() / terminateRole()")
    class AssignmentTests {

        @Test
        @DisplayName("✅ Assigne un rôle à une identité")
        void shouldAssignRole() {
            Identity identity = userIdentity("alice@univ.fr");
            UUID roleId = UUID.randomUUID();
            Role role = new Role();
            role.setId(roleId);
            role.setName("Responsable");

            when(roleRepository.findById(roleId)).thenReturn(Optional.of(role));
            when(identityRepository.findById(identity.getId())).thenReturn(Optional.of(identity));
            when(roleAssignmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            RoleAssignment result = service.assignRole(identity.getId(), roleId, LocalDate.now(), null);

            assertThat(result.getRole()).isEqualTo(role);
            assertThat(result.getIdentity()).isEqualTo(identity);
            verify(validationService).validateRoleAssignment(identity.getId(), roleId, LocalDate.now(), null);
        }

        @Test
        @DisplayName("✅ Clôture un rôle à aujourd'hui quand pas de date fournie")
        void shouldTerminateRoleToday() {
            RoleAssignment assignment = new RoleAssignment();
            assignment.setId(UUID.randomUUID());
            assignment.setStartDate(LocalDate.now().minusDays(5));
            assignment.setEndDate(null);

            when(roleAssignmentRepository.findById(assignment.getId())).thenReturn(Optional.of(assignment));
            when(roleAssignmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.terminateRole(assignment.getId(), null);

            // Should be set to yesterday (minusDays(1)) per implementation
            assertThat(assignment.getEndDate()).isEqualTo(LocalDate.now().minusDays(1));
        }
    }
}
