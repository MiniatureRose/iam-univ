package fr.univ.iam.controller;

import fr.univ.iam.domain.Group;
import fr.univ.iam.dto.GroupDto;
import fr.univ.iam.dto.IdentityDto;
import fr.univ.iam.repository.GroupRepository;
import fr.univ.iam.repository.RoleAssignmentRepository;
import fr.univ.iam.service.IamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupRepository groupRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final IamService iamService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<List<GroupDto>> getAllGroups() {
        return ResponseEntity.ok(groupRepository.findAll().stream().map(GroupDto::from).toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or (hasRole('CONFIGURATOR') and #request.parentId() != null and @authz.canManageGroup(#request.parentId()))")
    public ResponseEntity<GroupDto> createGroup(@Valid @RequestBody GroupCreateRequest request) {
        return ResponseEntity.ok(GroupDto.from(iamService.createGroup(request.name(), request.parentId(), request.configuratorId())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or (hasRole('CONFIGURATOR') and @authz.canManageGroup(#id))")
    public ResponseEntity<GroupDto> updateGroup(@PathVariable UUID id, @Valid @RequestBody GroupCreateRequest request) {
        return ResponseEntity.ok(GroupDto.from(iamService.updateGroup(id, request.name())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteGroup(@PathVariable UUID id) {
        iamService.deleteGroup(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/members")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<Set<IdentityDto>> getGroupMembers(
            @PathVariable UUID groupId,
            @RequestParam(required = false) LocalDate date) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        Set<IdentityDto> members = roleAssignmentRepository.findActiveMembersByGroupId(groupId, targetDate)
                .stream().map(IdentityDto::from).collect(Collectors.toSet());
        return ResponseEntity.ok(members);
    }

    @GetMapping("/{groupId}/configurators")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<Set<IdentityDto>> getGroupConfigurators(@PathVariable UUID groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        return ResponseEntity.ok(group.getConfigurators().stream().map(IdentityDto::from).collect(Collectors.toSet()));
    }

    @PostMapping("/{groupId}/configurators")
    @PreAuthorize("hasRole('ADMIN') or (hasRole('CONFIGURATOR') and @authz.canManageGroup(#groupId))")
    public ResponseEntity<Set<IdentityDto>> addGroupConfigurator(
            @PathVariable UUID groupId,
            @Valid @RequestBody ConfiguratorRequest request) {
        return ResponseEntity.ok(iamService.addGroupConfigurator(groupId, request.identityId())
                .stream().map(IdentityDto::from).collect(Collectors.toSet()));
    }

    @DeleteMapping("/{groupId}/configurators/{identityId}")
    @PreAuthorize("hasRole('ADMIN') or (hasRole('CONFIGURATOR') and @authz.canManageGroup(#groupId))")
    public ResponseEntity<Void> removeGroupConfigurator(@PathVariable UUID groupId, @PathVariable UUID identityId) {
        iamService.removeGroupConfigurator(groupId, identityId);
        return ResponseEntity.noContent().build();
    }

    public record GroupCreateRequest(@NotBlank String name, UUID parentId, UUID configuratorId) {}
    public record ConfiguratorRequest(@NotNull UUID identityId) {}
}
