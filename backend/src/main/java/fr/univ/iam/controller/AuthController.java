package fr.univ.iam.controller;

import fr.univ.iam.dto.IdentityDto;
import fr.univ.iam.repository.IdentityRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final IdentityRepository identityRepository;
    private final AuthenticationManager authenticationManager;

    private static final HttpSessionSecurityContextRepository SESSION_REPO =
            new HttpSessionSecurityContextRepository();

    /** Authenticates the user and creates an HTTP session. Returns the authenticated identity. */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req,
                                   HttpServletRequest request, HttpServletResponse response) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.email(), req.password()));
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth);
            SecurityContextHolder.setContext(context);
            SESSION_REPO.saveContext(context, request, response);
            return identityRepository.findByPrimaryEmail(req.email())
                    .map(i -> ResponseEntity.ok(IdentityDto.from(i)))
                    .orElse(ResponseEntity.status(401).build());
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body("Email ou mot de passe incorrect.");
        }
    }

    /** Invalidates the current session and clears the security context. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        new SecurityContextLogoutHandler().logout(
                request, response, SecurityContextHolder.getContext().getAuthentication());
        return ResponseEntity.noContent().build();
    }

    /** Returns the IdentityDto of the currently authenticated user, or 401 if unauthenticated. */
    @GetMapping("/me")
    public ResponseEntity<IdentityDto> getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return ResponseEntity.status(401).build();
        }
        return identityRepository.findByPrimaryEmail(auth.getName())
                .map(i -> ResponseEntity.ok(IdentityDto.from(i)))
                .orElse(ResponseEntity.status(401).build());
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
}
