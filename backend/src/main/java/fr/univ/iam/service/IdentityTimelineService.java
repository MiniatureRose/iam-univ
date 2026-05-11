package fr.univ.iam.service;

import fr.univ.iam.domain.Identity;
import fr.univ.iam.dto.IdentityDto;
import fr.univ.iam.dto.RoleAssignmentDto;
import fr.univ.iam.repository.IdentityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IdentityTimelineService {

    private final IdentityRepository identityRepository;

    /** Returns a snapshot of the identity's roles that were active at the given date. */
    @Transactional(readOnly = true)
    public IdentitySnapshot getActiveSnapshot(UUID identityId, LocalDate targetDate) {
        Identity identity = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        List<RoleAssignmentDto> activeRoles = identity.getRoleAssignments().stream()
                .filter(a -> isActiveAt(a.getStartDate(), a.getEndDate(), targetDate))
                .map(RoleAssignmentDto::from)
                .toList();

        return new IdentitySnapshot(IdentityDto.from(identity), activeRoles);
    }

    /** Returns a snapshot containing the identity's full assignment history (all dates). */
    @Transactional(readOnly = true)
    public IdentitySnapshot getFullSnapshot(UUID identityId) {
        Identity identity = identityRepository.findById(identityId)
                .orElseThrow(() -> new IllegalArgumentException("Identity not found: " + identityId));

        List<RoleAssignmentDto> allRoles = identity.getRoleAssignments().stream()
                .map(RoleAssignmentDto::from)
                .toList();

        return new IdentitySnapshot(IdentityDto.from(identity), allRoles);
    }

    /**
     * Returns paginated snapshots filtered by a name/email query, with roles active at the given date.
     * Uses a two-step approach: first paginate on IDs (clean SQL LIMIT/OFFSET), then batch-fetch
     * full entities for only the current page to avoid the Hibernate pagination-with-fetch-join warning.
     */
    @Transactional(readOnly = true)
    public Page<IdentitySnapshot> getSearchSnapshots(String query, LocalDate targetDate, Pageable pageable) {
        Page<UUID> idPage = identityRepository.searchIdentityIds(query, pageable);

        if (idPage.isEmpty()) {
            return idPage.map(id -> null);
        }

        List<Identity> identities = identityRepository.findAllWithRoleAssignmentsByIds(idPage.getContent());

        Map<UUID, Identity> byId = identities.stream()
                .collect(Collectors.toMap(Identity::getId, i -> i));

        return idPage.map(id -> {
            Identity identity = byId.get(id);
            if (identity == null) return null;
            List<RoleAssignmentDto> activeRoles = identity.getRoleAssignments().stream()
                    .filter(a -> isActiveAt(a.getStartDate(), a.getEndDate(), targetDate))
                    .map(RoleAssignmentDto::from)
                    .toList();
            return new IdentitySnapshot(IdentityDto.from(identity), activeRoles);
        });
    }

    private boolean isActiveAt(LocalDate start, LocalDate end, LocalDate target) {
        if (start.isAfter(target)) return false;
        if (end != null && end.isBefore(target)) return false;
        return true;
    }

    /** Snapshot pairing an identity with the subset of role assignments relevant to the request. */
    public record IdentitySnapshot(IdentityDto identity, List<RoleAssignmentDto> roles) {}
}
