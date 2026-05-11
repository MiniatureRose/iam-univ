package fr.univ.iam.dto;

import fr.univ.iam.domain.Status;

import java.util.UUID;

public record StatusDto(UUID id, String name, String description) {

    public static StatusDto from(Status s) {
        if (s == null) return null;
        return new StatusDto(s.getId(), s.getName(), s.getDescription());
    }
}
