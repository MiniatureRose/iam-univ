package fr.univ.iam.repository;

import fr.univ.iam.domain.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public interface GroupRepository extends JpaRepository<Group, UUID> {

    /** Returns all active groups for which the identity with the given email is a configurator. */
    @Query("SELECT g FROM Group g JOIN g.configurators c WHERE c.primaryEmail = :email AND g.active = true")
    List<Group> findActiveGroupsManagedByEmail(@Param("email") String email);

    /** Returns true if any ACTIVE group has the given identity as a configurator. */
    @Query("SELECT COUNT(g) > 0 FROM Group g JOIN g.configurators c WHERE c.id = :identityId AND g.active = true")
    boolean existsByConfiguratorId(@Param("identityId") UUID identityId);

    /** Returns the IDs of all active groups managed by the identity with the given email. */
    @Query("SELECT g.id FROM Group g JOIN g.configurators c WHERE c.primaryEmail = :email AND g.active = true")
    Set<UUID> findManagedGroupIdsByEmail(@Param("email") String email);

    /** Returns all active groups for which the identity with the given ID is a configurator. */
    @Query("SELECT g FROM Group g JOIN g.configurators c WHERE c.id = :configuratorId AND g.active = true")
    List<Group> findActiveGroupsByConfiguratorId(@Param("configuratorId") UUID configuratorId);

    List<Group> findByActiveTrue();
}
