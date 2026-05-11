package fr.univ.iam.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;
import java.util.Set;
import java.util.HashSet;

@Entity
@Table(name = "identities")
@Getter
@Setter
public class Identity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(nullable = false, unique = true)
    private String primaryEmail;

    @Column(nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private boolean mustChangePassword = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AppRole appRole = AppRole.USER;

    private String personalEmail;

    private String phone;

    @OneToMany(mappedBy = "identity", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RoleAssignment> roleAssignments = new ArrayList<>();

    @JsonIgnore
    @ManyToMany(mappedBy = "configurators")
    private Set<Group> managedGroups = new HashSet<>();

    @ManyToOne
    @JoinColumn(name = "status_id")
    private Status status;

}
