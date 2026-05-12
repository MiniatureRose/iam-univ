package fr.univ.iam.controller;

import fr.univ.iam.dto.AuditLogDto;
import fr.univ.iam.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Page<AuditLogDto> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestParam(required = false) String entityType
    ) {
        var pageable = PageRequest.of(page, Math.min(size, 100));
        if (entityType != null && !entityType.isBlank()) {
            return auditLogRepository
                    .findByEntityTypeOrderByTimestampDesc(entityType, pageable)
                    .map(AuditLogDto::from);
        }
        return auditLogRepository
                .findAllByOrderByTimestampDesc(pageable)
                .map(AuditLogDto::from);
    }
}
