package fr.univ.iam.service;

import fr.univ.iam.exception.OverlapAssignmentException;
import fr.univ.iam.repository.RoleAssignmentRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AssignmentValidationService – Unit Tests")
class AssignmentValidationServiceTest {

    @Mock
    RoleAssignmentRepository roleAssignmentRepository;

    @InjectMocks
    AssignmentValidationService service;

    private final UUID IDENTITY_ID = UUID.randomUUID();
    private final UUID ROLE_ID     = UUID.randomUUID();
    private final LocalDate TODAY  = LocalDate.now();

    // ─── Date validation ───────────────────────────────────────────────────────

    @Test
    @DisplayName("Throws when start date is after end date")
    void shouldThrowWhenStartAfterEnd() {
        assertThatThrownBy(() -> service.validateRoleAssignment(
                IDENTITY_ID, ROLE_ID, TODAY.plusDays(5), TODAY))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("before end date");
    }

    @Test
    @DisplayName("Accepts identical start and end dates")
    void shouldAcceptSameDates() {
        when(roleAssignmentRepository.existsByIdentityIdAndRoleIdAndStartDate(IDENTITY_ID, ROLE_ID, TODAY))
                .thenReturn(false);
        service.validateRoleAssignment(IDENTITY_ID, ROLE_ID, TODAY, TODAY);
    }

    @Test
    @DisplayName("Accepts null end date (open-ended assignment)")
    void shouldAcceptNullEndDate() {
        when(roleAssignmentRepository.existsByIdentityIdAndRoleIdAndStartDate(IDENTITY_ID, ROLE_ID, TODAY))
                .thenReturn(false);
        service.validateRoleAssignment(IDENTITY_ID, ROLE_ID, TODAY, null);
    }

    // ─── Duplicate start-date detection ───────────────────────────────────────

    @Test
    @DisplayName("Throws OverlapAssignmentException when same identity, role, and start date already exist")
    void shouldThrowOnExactSameStartDate() {
        when(roleAssignmentRepository.existsByIdentityIdAndRoleIdAndStartDate(IDENTITY_ID, ROLE_ID, TODAY))
                .thenReturn(true);

        assertThatThrownBy(() -> service.validateRoleAssignment(IDENTITY_ID, ROLE_ID, TODAY, null))
                .isInstanceOf(OverlapAssignmentException.class)
                .hasMessageContaining("already starts on this date");
    }

    @Test
    @DisplayName("Accepts a different start date for the same identity and role")
    void shouldAcceptDifferentStartDate() {
        when(roleAssignmentRepository.existsByIdentityIdAndRoleIdAndStartDate(IDENTITY_ID, ROLE_ID, TODAY))
                .thenReturn(false);
        service.validateRoleAssignment(IDENTITY_ID, ROLE_ID, TODAY, null);
    }

    @Test
    @DisplayName("Accepts the same start date when the role is different")
    void shouldAcceptSameDateDifferentRole() {
        UUID otherRoleId = UUID.randomUUID();
        when(roleAssignmentRepository.existsByIdentityIdAndRoleIdAndStartDate(IDENTITY_ID, otherRoleId, TODAY))
                .thenReturn(false);
        service.validateRoleAssignment(IDENTITY_ID, otherRoleId, TODAY, null);
    }

    @Test
    @DisplayName("Accepts the same start date and role when the identity is different")
    void shouldAcceptSameDateDifferentIdentity() {
        UUID otherIdentityId = UUID.randomUUID();
        when(roleAssignmentRepository.existsByIdentityIdAndRoleIdAndStartDate(otherIdentityId, ROLE_ID, TODAY))
                .thenReturn(false);
        service.validateRoleAssignment(otherIdentityId, ROLE_ID, TODAY, null);
    }
}
