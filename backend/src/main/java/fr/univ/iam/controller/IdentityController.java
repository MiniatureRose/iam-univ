package fr.univ.iam.controller;

import fr.univ.iam.domain.AppRole;
import fr.univ.iam.dto.*;
import fr.univ.iam.repository.*;
import fr.univ.iam.service.IdentityTimelineService;
import fr.univ.iam.service.IamService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class IdentityController {

    private final IdentityRepository identityRepository;
    private final RoleRepository roleRepository;
    private final GroupRepository groupRepository;
    private final StatusRepository statusRepository;
    private final IdentityTimelineService timelineService;
    private final IamService iamService;

    // ─── Stats ─────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<StatsDto> getStats() {
        return ResponseEntity.ok(new StatsDto(
                identityRepository.count(),
                roleRepository.count(),
                groupRepository.count(),
                statusRepository.count()));
    }

    // ─── Identities ────────────────────────────────────────────────────────────

    @GetMapping("/identities")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<Page<IdentityDto>> getAllIdentities(
            @RequestParam(required = false) List<AppRole> appRoles,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<fr.univ.iam.domain.Identity> identities = appRoles != null && !appRoles.isEmpty()
                ? identityRepository.findByAppRoleIn(appRoles, pageable)
                : identityRepository.findAll(pageable);
        return ResponseEntity.ok(identities.map(IdentityDto::from));
    }

    @GetMapping("/identities/snapshots")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<Page<IdentityTimelineService.IdentitySnapshot>> getAllSnapshots(
            @RequestParam(required = false) LocalDate date,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(timelineService.getSearchSnapshots(query, targetDate, pageable));
    }

    @GetMapping("/identities/{id}")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<IdentityDto> getIdentity(@PathVariable UUID id) {
        return identityRepository.findById(id)
                .map(i -> ResponseEntity.ok(IdentityDto.from(i)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/identities/{id}/groups")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<List<GroupDto>> getIdentityGroups(@PathVariable UUID id) {
        fr.univ.iam.domain.Identity identity = identityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + id));
        List<GroupDto> groups = identity.getRoleAssignments().stream()
                .map(r -> r.getRole().getGroup())
                .filter(Objects::nonNull)
                .distinct()
                .map(GroupDto::from)
                .toList();
        return ResponseEntity.ok(groups);
    }

    @GetMapping("/identities/{id}/timeline")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<IdentityTimelineService.IdentitySnapshot> getTimeline(
            @PathVariable UUID id, @RequestParam(required = false) LocalDate date) {
        if (date != null) {
            return ResponseEntity.ok(timelineService.getActiveSnapshot(id, date));
        }
        return ResponseEntity.ok(timelineService.getFullSnapshot(id));
    }

    @PostMapping("/identities")
    @PreAuthorize("hasAnyRole('ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<IdentityCreateResponse> createIdentity(
            @Valid @RequestBody IdentityCreateRequest request,
            org.springframework.security.core.Authentication auth) {
        boolean callerIsAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        IdentityCreateResult result = iamService.createIdentity(request.firstName(), request.lastName(),
                request.email(), request.phone(), request.appRole(), request.statusId(), callerIsAdmin);
        return ResponseEntity.ok(new IdentityCreateResponse(
                IdentityDto.from(result.identity()), result.temporaryPassword()));
    }

    @PutMapping("/identities/{id}/app-role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IdentityDto> updateAppRole(
            @PathVariable UUID id,
            @Valid @RequestBody AppRoleUpdateRequest request,
            org.springframework.security.core.Authentication auth) {
        return ResponseEntity.ok(IdentityDto.from(iamService.updateAppRole(id, request.appRole(), auth.getName())));
    }

    @DeleteMapping("/identities/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteIdentity(@PathVariable UUID id) {
        iamService.deleteIdentity(id);
        return ResponseEntity.noContent().build();
    }

    // ─── Assignments ───────────────────────────────────────────────────────────

    @PostMapping("/identities/{identityId}/assignments/roles")
    @PreAuthorize("hasRole('ADMIN') or (hasRole('CONFIGURATOR') and @authz.canAssignRole(#request.roleId()))")
    public ResponseEntity<RoleAssignmentDto> assignRole(
            @PathVariable UUID identityId,
            @Valid @RequestBody RoleAssignmentRequest request) {
        return ResponseEntity.ok(
                RoleAssignmentDto.from(iamService.assignRole(identityId, request.roleId(), request.startDate(), request.endDate())));
    }

    @PutMapping("/identities/{identityId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IdentityDto> assignStatus(
            @PathVariable UUID identityId,
            @Valid @RequestBody StatusAssignmentRequest request) {
        return ResponseEntity.ok(IdentityDto.from(iamService.assignStatus(identityId, request.statusId())));
    }

    @PatchMapping("/assignments/roles/{id}/terminate")
    @PreAuthorize("hasRole('ADMIN') or (hasRole('CONFIGURATOR') and @authz.canTerminateRole(#id))")
    public ResponseEntity<Void> terminateRole(
            @PathVariable UUID id,
            @RequestParam(required = false) LocalDate endDate) {
        iamService.terminateRole(id, endDate);
        return ResponseEntity.noContent().build();
    }

    // ─── Inner DTOs ────────────────────────────────────────────────────────────

    public record RoleAssignmentRequest(@NotNull UUID roleId, @NotNull LocalDate startDate, LocalDate endDate) {}
    public record StatusAssignmentRequest(UUID statusId) {}
    public record IdentityCreateRequest(
            @NotBlank String firstName,
            @NotBlank String lastName,
            @NotBlank @Email String email,
            String phone,
            AppRole appRole,
            UUID statusId) {}
    public record AppRoleUpdateRequest(@NotNull AppRole appRole) {}
    public record StatsDto(long identities, long roles, long groups, long statuses) {}
    public record IdentityCreateResponse(IdentityDto identity, String temporaryPassword) {}
}
