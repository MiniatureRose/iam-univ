package fr.univ.iam.controller;

import fr.univ.iam.dto.StatusDto;
import fr.univ.iam.repository.StatusRepository;
import fr.univ.iam.service.IamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/statuses")
@RequiredArgsConstructor
public class StatusController {

    private final StatusRepository statusRepository;
    private final IamService iamService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<StatusDto>> getAllStatuses() {
        return ResponseEntity.ok(statusRepository.findAll().stream().map(StatusDto::from).toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StatusDto> createStatus(@Valid @RequestBody StatusCreateRequest request) {
        return ResponseEntity.ok(StatusDto.from(iamService.createStatus(request.name(), request.description())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteStatus(@PathVariable UUID id) {
        iamService.deleteStatus(id);
        return ResponseEntity.noContent().build();
    }

    public record StatusCreateRequest(@NotBlank String name, String description) {}
}
