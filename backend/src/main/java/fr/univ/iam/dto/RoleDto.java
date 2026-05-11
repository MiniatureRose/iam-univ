package fr.univ.iam.dto;

import fr.univ.iam.domain.Role;

import java.util.UUID;

public record RoleDto(UUID id, String name, String description, boolean active, GroupRef group) {

    public record GroupRef(UUID id, String name) {}

    public static RoleDto from(Role r) {
        GroupRef groupRef = r.getGroup() != null
                ? new GroupRef(r.getGroup().getId(), r.getGroup().getName())
                : null;
        return new RoleDto(r.getId(), r.getName(), r.getDescription(), r.isActive(), groupRef);
    }
}
