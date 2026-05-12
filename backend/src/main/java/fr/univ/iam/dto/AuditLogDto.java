package fr.univ.iam.dto;

import fr.univ.iam.domain.AuditLog;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditLogDto(
        UUID id,
        String action,
        String entityType,
        String entityId,
        String entityName,
        String actorEmail,
        String details,
        LocalDateTime timestamp
) {
    public static AuditLogDto from(AuditLog log) {
        return new AuditLogDto(
                log.getId(),
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getEntityName(),
                log.getActorEmail(),
                log.getDetails(),
                log.getTimestamp()
        );
    }
}
