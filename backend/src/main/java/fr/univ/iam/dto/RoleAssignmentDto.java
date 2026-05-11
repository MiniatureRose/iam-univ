package fr.univ.iam.dto;

import fr.univ.iam.domain.RoleAssignment;

import java.time.LocalDate;
import java.util.UUID;

public record RoleAssignmentDto(UUID id, RoleDto role, LocalDate startDate, LocalDate endDate) {

    public static RoleAssignmentDto from(RoleAssignment ra) {
        return new RoleAssignmentDto(
                ra.getId(),
                RoleDto.from(ra.getRole()),
                ra.getStartDate(),
                ra.getEndDate()
        );
    }
}
