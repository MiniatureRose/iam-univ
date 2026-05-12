package fr.univ.iam.dto;

import fr.univ.iam.domain.AppRole;
import fr.univ.iam.domain.Identity;

import java.util.UUID;

public record IdentityDto(
        UUID id,
        String firstName,
        String lastName,
        String primaryEmail,
        String phone,
        String personalEmail,
        AppRole appRole,
        StatusDto status,
        boolean mustChangePassword
) {
    public static IdentityDto from(Identity i) {
        return new IdentityDto(
                i.getId(), i.getFirstName(), i.getLastName(),
                i.getPrimaryEmail(), i.getPhone(), i.getPersonalEmail(),
                i.getAppRole(),
                StatusDto.from(i.getStatus()),
                i.isMustChangePassword()
        );
    }
}
