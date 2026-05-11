package fr.univ.iam.controller;

import fr.univ.iam.dto.RoleDto;
import fr.univ.iam.repository.RoleRepository;
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
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
public class RoleController {

    private final RoleRepository roleRepository;
    private final IamService iamService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CONFIGURATOR')")
    public ResponseEntity<List<RoleDto>> getAllRoles() {
        return ResponseEntity.ok(roleRepository.findAll().stream().map(RoleDto::from).toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or (hasRole('CONFIGURATOR') and @authz.canManageGroup(#request.groupId()))")
    public ResponseEntity<RoleDto> createRole(@Valid @RequestBody RoleCreateRequest request) {
        return ResponseEntity.ok(RoleDto.from(iamService.createRole(request.name(), request.description(), request.groupId())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteRole(@PathVariable UUID id) {
        iamService.deleteRole(id);
        return ResponseEntity.noContent().build();
    }

    public record RoleCreateRequest(@NotBlank String name, String description, UUID groupId) {}
}
