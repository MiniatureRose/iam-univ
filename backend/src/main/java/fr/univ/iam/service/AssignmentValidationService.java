package fr.univ.iam.service;

import fr.univ.iam.exception.OverlapAssignmentException;
import fr.univ.iam.repository.RoleAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AssignmentValidationService {

    private final RoleAssignmentRepository roleAssignmentRepository;

    /**
     * Validates that a new role assignment is permissible.
     * Rejects the assignment if startDate is after endDate, or if an assignment
     * for the same identity, role, and start date already exists.
     */
    public void validateRoleAssignment(UUID identityId, UUID roleId, LocalDate startDate, LocalDate endDate) {
        if (endDate != null && startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date must be before end date.");
        }

        // Multiple assignments of the same role are allowed across different date ranges;
        // only an exact duplicate start date is rejected.
        if (roleAssignmentRepository.existsByIdentityIdAndRoleIdAndStartDate(identityId, roleId, startDate)) {
            throw new OverlapAssignmentException(
                    "An assignment for this identity and role already starts on this date.");
        }
    }
}
