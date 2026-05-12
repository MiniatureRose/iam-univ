package fr.univ.iam.service;

import fr.univ.iam.domain.*;
import fr.univ.iam.dto.IdentityCreateResult;
import fr.univ.iam.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.HashSet;
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
    private final AuditLogService auditLog;

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
        if (appRole != null) identity.setAppRole(appRole);

        if (statusId != null) {
            Status status = statusRepository.findById(statusId)
                    .orElseThrow(() -> new IllegalArgumentException("Status not found: " + statusId));
            identity.setStatus(status);
        }

        Identity saved = identityRepository.save(identity);
        auditLog.log("IDENTITY_CREATED", "IDENTITY", saved.getId().toString(),
                firstName + " " + lastName, "Email : " + email);
        return new IdentityCreateResult(saved, tempPassword);
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

        AppRole oldRole = identity.getAppRole();
        identity.setAppRole(appRole);

        if (appRole == AppRole.USER) {
            groupRepository.findActiveGroupsByConfiguratorId(id).forEach(group -> {
                group.getConfigurators().remove(identity);
                groupRepository.save(group);
            });
        }

        Identity saved = identityRepository.save(identity);
        auditLog.log("APP_ROLE_CHANGED", "IDENTITY", id.toString(),
                identity.getFirstName() + " " + identity.getLastName(),
                "Rôle : " + oldRole + " → " + appRole);
        return saved;
    }

    public void deleteIdentity(UUID id) {
        Identity identity = identityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + id));
        String name = identity.getFirstName() + " " + identity.getLastName();
        identityRepository.deleteById(id);
        auditLog.log("IDENTITY_DELETED", "IDENTITY", id.toString(), name, null);
    }

    public Role createRole(String name, String description, UUID groupId) {
        Role role = new Role();
        role.setName(name);
        role.setDescription(description);
        String groupName = null;
        if (groupId != null) {
            Group group = groupRepository.findById(groupId)
                    .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
            role.setGroup(group);
            groupName = group.getName();
        }
        Role saved = roleRepository.save(role);
        auditLog.log("ROLE_CREATED", "ROLE", saved.getId().toString(), name,
                groupName != null ? "Groupe : " + groupName : null);
        return saved;
    }

    public void deleteRole(UUID id) {
        roleRepository.findById(id).ifPresent(role -> {
            String roleName = role.getName();
            role.setActive(false);
            roleRepository.save(role);
            roleAssignmentRepository.findByRoleId(id).stream()
                    .filter(a -> a.getEndDate() == null || a.getEndDate().isAfter(LocalDate.now()))
                    .forEach(a -> {
                        a.setEndDate(LocalDate.now());
                        roleAssignmentRepository.save(a);
                    });
            auditLog.log("ROLE_DELETED", "ROLE", id.toString(), roleName, null);
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
        if (!role.isActive()) {
            throw new IllegalArgumentException("Cannot assign a deleted role.");
        }
        validationService.validateRoleAssignment(identityId, roleId, startDate, endDate);
        Identity identity = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        RoleAssignment assignment = new RoleAssignment();
        assignment.setIdentity(identity);
        assignment.setRole(role);
        assignment.setStartDate(startDate);
        assignment.setEndDate(endDate);
        RoleAssignment saved = roleAssignmentRepository.save(assignment);

        String groupPart = role.getGroup() != null ? " (" + role.getGroup().getName() + ")" : "";
        auditLog.log("ROLE_ASSIGNED", "ROLE_ASSIGNMENT", saved.getId().toString(),
                identity.getFirstName() + " " + identity.getLastName(),
                "Rôle : " + role.getName() + groupPart + ", depuis le " + startDate);
        return saved;
    }

    public Identity assignStatus(UUID identityId, UUID statusId) {
        Identity identity = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        String statusName;
        if (statusId == null) {
            identity.setStatus(null);
            statusName = "—";
        } else {
            Status status = statusRepository.findById(statusId)
                    .orElseThrow(() -> new IllegalArgumentException("Status not found: " + statusId));
            identity.setStatus(status);
            statusName = status.getName();
        }
        Identity saved = identityRepository.save(identity);
        auditLog.log("STATUS_ASSIGNED", "IDENTITY", identityId.toString(),
                identity.getFirstName() + " " + identity.getLastName(),
                "Statut : " + statusName);
        return saved;
    }

    public Group createGroup(String name, UUID parentId, UUID configuratorId) {
        Group group = new Group();
        group.setName(name);
        String parentName = null;
        if (parentId != null) {
            Group parent = groupRepository.findById(parentId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent group not found: " + parentId));
            group.setParent(parent);
            parentName = parent.getName();
        }
        group = groupRepository.save(group);

        if (configuratorId != null) {
            Identity configurator = identityRepository.findById(configuratorId)
                    .orElseThrow(() -> new IllegalArgumentException("Configurator identity not found: " + configuratorId));
            group.getConfigurators().add(configurator);
            group = groupRepository.save(group);
            promoteToConfiguratorIfNeeded(configurator);
        }
        auditLog.log("GROUP_CREATED", "GROUP", group.getId().toString(), name,
                parentName != null ? "Groupe parent : " + parentName : null);
        return group;
    }

    public Group updateGroup(UUID id, String name) {
        Group group = groupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + id));
        String oldName = group.getName();
        group.setName(name);
        Group saved = groupRepository.save(group);
        auditLog.log("GROUP_RENAMED", "GROUP", id.toString(), name, "Ancien nom : " + oldName);
        return saved;
    }

    public void deleteGroup(UUID id) {
        groupRepository.findById(id).ifPresent(group -> {
            String groupName = group.getName();
            group.setActive(false);

            Set<Identity> formerConfigurators = new HashSet<>(group.getConfigurators());
            group.getConfigurators().clear();
            groupRepository.save(group);

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

            formerConfigurators.forEach(c -> {
                if (!groupRepository.existsByConfiguratorId(c.getId()) && c.getAppRole() == AppRole.CONFIGURATOR) {
                    c.setAppRole(AppRole.USER);
                    identityRepository.save(c);
                }
            });

            auditLog.log("GROUP_DELETED", "GROUP", id.toString(), groupName, null);
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
        auditLog.log("CONFIGURATOR_ADDED", "GROUP", groupId.toString(), group.getName(),
                "Configurateur : " + configurator.getFirstName() + " " + configurator.getLastName());
        return group.getConfigurators();
    }

    public void removeGroupConfigurator(UUID groupId, UUID identityId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        Identity configurator = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        Authentication callerAuth = SecurityContextHolder.getContext().getAuthentication();
        boolean callerIsAdmin = callerAuth != null && callerAuth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (!callerIsAdmin && group.getConfigurators().size() <= 1 && group.getConfigurators().contains(configurator)) {
            throw new IllegalStateException("Cannot remove the last configurator of a group.");
        }

        group.getConfigurators().remove(configurator);
        groupRepository.save(group);

        if (!groupRepository.existsByConfiguratorId(identityId) && configurator.getAppRole() == AppRole.CONFIGURATOR) {
            configurator.setAppRole(AppRole.USER);
            identityRepository.save(configurator);
        }
        auditLog.log("CONFIGURATOR_REMOVED", "GROUP", groupId.toString(), group.getName(),
                "Configurateur : " + configurator.getFirstName() + " " + configurator.getLastName());
    }

    public void terminateRole(UUID id, LocalDate endDate) {
        RoleAssignment assignment = roleAssignmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Role assignment not found: " + id));
        String identityName = assignment.getIdentity().getFirstName() + " " + assignment.getIdentity().getLastName();
        String roleName = assignment.getRole().getName();
        LocalDate effectiveEnd = endDate != null ? endDate : LocalDate.now().minusDays(1);
        assignment.setEndDate(effectiveEnd);
        roleAssignmentRepository.save(assignment);
        auditLog.log("ROLE_TERMINATED", "ROLE_ASSIGNMENT", id.toString(), identityName,
                "Rôle : " + roleName + ", fin le " + effectiveEnd);
    }

    private void promoteToConfiguratorIfNeeded(Identity identity) {
        if (identity.getAppRole() == AppRole.USER) {
            identity.setAppRole(AppRole.CONFIGURATOR);
            identityRepository.save(identity);
        }
    }
}
