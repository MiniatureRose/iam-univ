package fr.univ.iam.controller;

import fr.univ.iam.domain.Identity;
import fr.univ.iam.dto.GroupDto;
import fr.univ.iam.dto.IdentityDto;
import fr.univ.iam.repository.IdentityRepository;
import fr.univ.iam.repository.GroupRepository;
import fr.univ.iam.service.AuditLogService;
import fr.univ.iam.service.IdentityTimelineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
public class MeController {

    private final IdentityRepository identityRepository;
    private final IdentityTimelineService timelineService;
    private final GroupRepository groupRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLog;

    /** Returns the authenticated user's current profile snapshot. */
    @GetMapping
    public ResponseEntity<IdentityTimelineService.IdentitySnapshot> getMyProfile() {
        Identity identity = getAuthenticatedIdentity();
        return ResponseEntity.ok(timelineService.getActiveSnapshot(identity.getId(), LocalDate.now()));
    }

    /** Returns all active groups for which the authenticated user is a configurator. */
    @GetMapping("/managed-groups")
    public ResponseEntity<List<GroupDto>> getMyManagedGroups() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return ResponseEntity.ok(groupRepository.findActiveGroupsManagedByEmail(auth.getName())
                .stream().map(GroupDto::from).toList());
    }

    /** Updates the authenticated user's personal contact information. */
    @PutMapping("/contact")
    public ResponseEntity<IdentityDto> updateContact(@Valid @RequestBody ContactUpdateRequest dto) {
        Identity identity = getAuthenticatedIdentity();
        identity.setPersonalEmail(dto.personalEmail());
        identity.setPhone(dto.phone());
        return ResponseEntity.ok(IdentityDto.from(identityRepository.save(identity)));
    }

    /** Changes the authenticated user's password. Clears mustChangePassword on success. */
    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody PasswordChangeRequest dto) {
        Identity identity = getAuthenticatedIdentity();

        if (!passwordEncoder.matches(dto.currentPassword(), identity.getPassword())) {
            return ResponseEntity.status(403).body("Mot de passe actuel incorrect.");
        }
        if (dto.newPassword().length() < 8) {
            return ResponseEntity.badRequest().body("Le nouveau mot de passe doit contenir au moins 8 caractères.");
        }

        identity.setPassword(passwordEncoder.encode(dto.newPassword()));
        identity.setMustChangePassword(false);
        identityRepository.save(identity);
        auditLog.log("PASSWORD_CHANGED", "IDENTITY", identity.getId().toString(),
                identity.getFirstName() + " " + identity.getLastName(), null);
        return ResponseEntity.noContent().build();
    }

    private Identity getAuthenticatedIdentity() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return identityRepository.findByPrimaryEmail(auth.getName())
                .orElseThrow(() -> new RuntimeException("Identity not found for authenticated user"));
    }

    public record ContactUpdateRequest(@Email String personalEmail, String phone) {}

    public record PasswordChangeRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8) String newPassword) {}
}
