package fr.univ.iam.service;

import fr.univ.iam.domain.*;
import fr.univ.iam.dto.IdentityCreateResult;
import fr.univ.iam.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class IamService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String TEMP_PWD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

    private final IdentityRepository identityRepository;
    private final RoleRepository roleRepository;
    private final GroupRepository groupRepository;
    private final StatusRepository statusRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final AssignmentValidationService validationService;
    private final PasswordEncoder passwordEncoder;

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) sb.append(TEMP_PWD_CHARS.charAt(RANDOM.nextInt(TEMP_PWD_CHARS.length())));
        return sb.toString();
    }

    public IdentityCreateResult createIdentity(String firstName, String lastName, String email, String phone,
            AppRole appRole, UUID statusId, boolean callerIsAdmin) {
        if (identityRepository.findByPrimaryEmail(email).isPresent()) {
            throw new IllegalStateException("The email address " + email + " is already in use.");
        }

        // Only admins may assign a role above USER at creation time.
        if (appRole != null && appRole != AppRole.USER) {
            if (!callerIsAdmin) {
                throw new SecurityException("Only an administrator can assign an elevated role.");
            }
        }

        String tempPassword = generateTempPassword();

        Identity identity = new Identity();
        identity.setFirstName(firstName);
        identity.setLastName(lastName);
        identity.setPrimaryEmail(email);
        identity.setPhone(phone);
        identity.setPassword(passwordEncoder.encode(tempPassword));
        identity.setMustChangePassword(true);
        if (appRole != null) {
            identity.setAppRole(appRole);
        }

        if (statusId != null) {
            Status status = statusRepository.findById(statusId)
                    .orElseThrow(() -> new IllegalArgumentException("Status not found: " + statusId));
            identity.setStatus(status);
        }
        return new IdentityCreateResult(identityRepository.save(identity), tempPassword);
    }

    public Identity updateAppRole(UUID id, AppRole appRole, String callerEmail) {
        Identity identity = identityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + id));

        if (identity.getPrimaryEmail().equals(callerEmail)) {
            throw new IllegalArgumentException("You cannot change your own role.");
        }

        if (appRole == AppRole.CONFIGURATOR && !groupRepository.existsByConfiguratorId(id)) {
            throw new IllegalArgumentException(
                    "Un configurateur doit gérer au moins un groupe. Ajoutez d'abord cette identité comme configurateur d'un groupe.");
        }

        identity.setAppRole(appRole);
        return identityRepository.save(identity);
    }

    public void deleteIdentity(UUID id) {
        identityRepository.deleteById(id);
    }

    public Role createRole(String name, String description, UUID groupId) {
        Role role = new Role();
        role.setName(name);
        role.setDescription(description);
        if (groupId != null) {
            Group group = groupRepository.findById(groupId)
                    .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
            role.setGroup(group);
        }
        return roleRepository.save(role);
    }

    public void deleteRole(UUID id) {
        roleRepository.findById(id).ifPresent(role -> {
            role.setActive(false);
            roleRepository.save(role);
            // Close all active assignments for this role
            roleAssignmentRepository.findByRoleId(id).stream()
                    .filter(a -> a.getEndDate() == null || a.getEndDate().isAfter(LocalDate.now()))
                    .forEach(a -> {
                        a.setEndDate(LocalDate.now());
                        roleAssignmentRepository.save(a);
                    });
        });
    }

    public Status createStatus(String name, String description) {
        Status status = new Status();
        status.setName(name);
        status.setDescription(description);
        return statusRepository.save(status);
    }

    public void deleteStatus(UUID id) {
        statusRepository.deleteById(id);
    }

    public RoleAssignment assignRole(UUID identityId, UUID roleId, LocalDate startDate, LocalDate endDate) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new IllegalArgumentException("Role not found: " + roleId));
        validationService.validateRoleAssignment(identityId, roleId, startDate, endDate);
        Identity identity = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        RoleAssignment assignment = new RoleAssignment();
        assignment.setIdentity(identity);
        assignment.setRole(role);
        assignment.setStartDate(startDate);
        assignment.setEndDate(endDate);
        return roleAssignmentRepository.save(assignment);
    }

    public Identity assignStatus(UUID identityId, UUID statusId) {
        Identity identity = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        if (statusId == null) {
            identity.setStatus(null);
        } else {
            Status status = statusRepository.findById(statusId)
                    .orElseThrow(() -> new IllegalArgumentException("Status not found: " + statusId));
            identity.setStatus(status);
        }
        return identityRepository.save(identity);
    }

    public Group createGroup(String name, UUID parentId, UUID configuratorId) {
        Group group = new Group();
        group.setName(name);
        if (parentId != null) {
            Group parent = groupRepository.findById(parentId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent group not found: " + parentId));
            group.setParent(parent);
        }
        group = groupRepository.save(group);

        if (configuratorId != null) {
            Identity configurator = identityRepository.findById(configuratorId)
                    .orElseThrow(() -> new IllegalArgumentException("Configurator identity not found: " + configuratorId));
            group.getConfigurators().add(configurator);
            group = groupRepository.save(group);
            promoteToConfiguratorIfNeeded(configurator);
        }
        return group;
    }

    public Group updateGroup(UUID id, String name) {
        Group group = groupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + id));
        group.setName(name);
        return groupRepository.save(group);
    }

    public void deleteGroup(UUID id) {
        groupRepository.findById(id).ifPresent(group -> {
            group.setActive(false);
            groupRepository.save(group);
            // Soft-delete all roles in the group and close their active assignments
            roleRepository.findByGroupId(id).forEach(role -> {
                role.setActive(false);
                roleRepository.save(role);
                roleAssignmentRepository.findByRoleId(role.getId()).stream()
                        .filter(a -> a.getEndDate() == null || a.getEndDate().isAfter(LocalDate.now()))
                        .forEach(a -> {
                            a.setEndDate(LocalDate.now());
                            roleAssignmentRepository.save(a);
                        });
            });
        });
    }

    public Set<Identity> addGroupConfigurator(UUID groupId, UUID identityId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        Identity configurator = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        group.getConfigurators().add(configurator);
        groupRepository.save(group);
        promoteToConfiguratorIfNeeded(configurator);
        return group.getConfigurators();
    }

    public void removeGroupConfigurator(UUID groupId, UUID identityId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        Identity configurator = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        if (group.getConfigurators().size() <= 1 && group.getConfigurators().contains(configurator)) {
            throw new IllegalStateException("Cannot remove the last configurator of a group.");
        }

        group.getConfigurators().remove(configurator);
        groupRepository.save(group);

        if (!groupRepository.existsByConfiguratorId(identityId) && configurator.getAppRole() == AppRole.CONFIGURATOR) {
            configurator.setAppRole(AppRole.USER);
            identityRepository.save(configurator);
        }
    }

    public void terminateRole(UUID id, LocalDate endDate) {
        RoleAssignment assignment = roleAssignmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Role assignment not found: " + id));
        assignment.setEndDate(endDate != null ? endDate : LocalDate.now().minusDays(1));
        roleAssignmentRepository.save(assignment);
    }

    /** Auto-promotes a USER to CONFIGURATOR when they are assigned to manage a group. */
    private void promoteToConfiguratorIfNeeded(Identity identity) {
        if (identity.getAppRole() == AppRole.USER) {
            identity.setAppRole(AppRole.CONFIGURATOR);
            identityRepository.save(identity);
        }
    }
}
