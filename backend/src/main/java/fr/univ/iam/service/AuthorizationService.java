package fr.univ.iam.service;

import fr.univ.iam.domain.RoleAssignment;
import fr.univ.iam.domain.Role;
import fr.univ.iam.repository.GroupRepository;
import fr.univ.iam.repository.RoleAssignmentRepository;
import fr.univ.iam.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;

/**
 * Centralized authorization checks used in {@code @PreAuthorize} SpEL expressions.
 * Registered as bean "authz" so SpEL can reference it as {@code @authz.canXxx(...)}.
 */
@Service("authz")
@RequiredArgsConstructor
public class AuthorizationService {

    private final GroupRepository groupRepository;
    private final RoleRepository roleRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;

    public boolean canManageGroup(UUID groupId) {
        if (groupId == null) return false;
        return getManagedGroupIds().contains(groupId);
    }

    public boolean canAssignRole(UUID roleId) {
        if (roleId == null) return false;
        Role role = roleRepository.findById(roleId).orElse(null);
        if (role == null || role.getGroup() == null) return false;
        return canManageGroup(role.getGroup().getId());
    }

    public boolean canTerminateRole(UUID assignmentId) {
        if (assignmentId == null) return false;
        RoleAssignment assignment = roleAssignmentRepository.findById(assignmentId).orElse(null);
        if (assignment == null || assignment.getRole() == null || assignment.getRole().getGroup() == null) {
            return false;
        }
        return canManageGroup(assignment.getRole().getGroup().getId());
    }

    private Set<UUID> getManagedGroupIds() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return Set.of();
        return groupRepository.findManagedGroupIdsByEmail(auth.getName());
    }
}
