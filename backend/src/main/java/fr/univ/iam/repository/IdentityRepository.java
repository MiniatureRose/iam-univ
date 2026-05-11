package fr.univ.iam.repository;

import fr.univ.iam.domain.Identity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IdentityRepository extends JpaRepository<Identity, UUID>, JpaSpecificationExecutor<Identity> {
    Optional<Identity> findByPrimaryEmail(String primaryEmail);
    Page<Identity> findByAppRoleIn(List<fr.univ.iam.domain.AppRole> roles, Pageable pageable);

    @Query("SELECT DISTINCT i FROM Identity i LEFT JOIN FETCH i.roleAssignments ra LEFT JOIN FETCH ra.role r LEFT JOIN FETCH r.group")
    List<Identity> findAllWithRoleAssignments();

    @Query(value = "SELECT DISTINCT i.id FROM Identity i " +
           "WHERE LOWER(i.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(i.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(i.primaryEmail) LIKE LOWER(CONCAT('%', :query, '%'))",
           countQuery = "SELECT COUNT(DISTINCT i.id) FROM Identity i " +
                        "WHERE LOWER(i.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
                        "OR LOWER(i.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
                        "OR LOWER(i.primaryEmail) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<UUID> searchIdentityIds(String query, Pageable pageable);

    @Query("SELECT DISTINCT i FROM Identity i LEFT JOIN FETCH i.roleAssignments ra LEFT JOIN FETCH ra.role r LEFT JOIN FETCH r.group WHERE i.id IN :ids")
    List<Identity> findAllWithRoleAssignmentsByIds(List<UUID> ids);
}
