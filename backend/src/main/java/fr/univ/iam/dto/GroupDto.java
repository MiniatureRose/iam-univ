package fr.univ.iam.dto;

import fr.univ.iam.domain.Group;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public record GroupDto(
        UUID id,
        String name,
        boolean active,
        UUID parentId,
        Set<IdentityDto> configurators
) {
    public static GroupDto from(Group g) {
        return new GroupDto(
                g.getId(),
                g.getName(),
                g.isActive(),
                g.getParentId(),
                g.getConfigurators().stream().map(IdentityDto::from).collect(Collectors.toSet())
        );
    }
}
