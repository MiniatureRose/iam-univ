package fr.univ.iam.repository;

import fr.univ.iam.domain.Identity;
import fr.univ.iam.domain.RoleAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface RoleAssignmentRepository extends JpaRepository<RoleAssignment, UUID> {

    List<RoleAssignment> findByRoleId(UUID roleId);

    /** Returns true when an assignment with the exact same identity, role, and start date already exists. */
    boolean existsByIdentityIdAndRoleIdAndStartDate(UUID identityId, UUID roleId, LocalDate startDate);

    /**
     * Returns all distinct identities that held an active role within the given group at the target date.
     * A role assignment is active when startDate <= targetDate and (endDate is null or endDate >= targetDate).
     */
    @Query("SELECT DISTINCT ra.identity FROM RoleAssignment ra " +
           "WHERE ra.role.group.id = :groupId " +
           "AND ra.startDate <= :targetDate " +
           "AND (ra.endDate IS NULL OR ra.endDate >= :targetDate)")
    List<Identity> findActiveMembersByGroupId(@Param("groupId") UUID groupId,
                                              @Param("targetDate") LocalDate targetDate);
}
