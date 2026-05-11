package fr.univ.iam.config;

import fr.univ.iam.domain.*;
import fr.univ.iam.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Seeds the in-memory H2 database with demo data on first startup.
 * Runs only when the database is empty (statusRepository.count() == 0).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final StatusRepository statusRepository;
    private final RoleRepository roleRepository;
    private final IdentityRepository identityRepository;
    private final RoleAssignmentRepository roleAssignmentRepository;
    private final GroupRepository groupRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (statusRepository.count() > 0) return;

        log.info("Seeding demo data...");

        // ─── Statuses (contractual relationships) ──────────────────────────────
        Status biatss          = createStatus("BIATSS", "Personnel administratif et technique");
        Status teacherResearch = createStatus("Enseignant-Chercheur", "Professeurs et Maîtres de conférences");
        Status phd             = createStatus("Doctorant", "Contrat doctoral, statut temporaire");
        createStatus("Chercheur Invité", "Statut temporaire lié à la recherche");
        createStatus("Étudiant", "Droits d'accès restreints");

        // ─── Groups (organizational units) ────────────────────────────────────
        Group dsi         = createGroup("Direction du Système d'Information");
        Group dri         = createGroup("Direction des Relations Internationales");
        Group iut         = createGroup("IUT de Saint-Denis");
        Group ufrSciences = createGroup("UFR Sciences");
        Group lipn        = createGroup("Laboratoire LIPN");
        Group hr          = createGroup("Service des Ressources Humaines");

        // ─── Roles (scoped to a group) ─────────────────────────────────────────
        Role itEngineer      = createRole("Ingénieur Informatique",    "Accès serveurs",          dsi);
        Role deptHead        = createRole("Chef de Département",        "Gestion d'équipe",        iut);
        Role director        = createRole("Directeur",                  "Direction de composante", iut);
        Role hrManager       = createRole("Gestionnaire Administratif", "Dossiers RH",             hr);
        Role projectOfficer  = createRole("Chargé de Mission",          "Droits transversaux",     dri);
        Role seniorLecturer  = createRole("Maître de Conférences",      "Enseignement/Recherche",  lipn);
        Role fullProfessor   = createRole("Professeur des Universités", "Enseignement/Recherche",  ufrSciences);

        // ─── Identities (demo accounts, all use password "password") ──────────
        Identity admin  = createIdentity("Admin",   "Système",       "admin@univ.fr",                      null,                AppRole.ADMIN,        null);
        Identity achraf = createIdentity("Achraf",  "Jdidi",         "achraf.jdidi@univ-paris13.fr",        "+33 6 12 34 56 78", AppRole.USER,         biatss);
        Identity sophie = createIdentity("Sophie",  "Martin",        "sophie.martin@univ-paris13.fr",       "+33 6 98 76 54 32", AppRole.USER,         teacherResearch);
        Identity pierre = createIdentity("Pierre",  "Durand",        "pierre.durand@univ-paris13.fr",       null,                AppRole.CONFIGURATOR, biatss);
        Identity amina  = createIdentity("Amina",   "Benali",        "amina.benali@univ-paris13.fr",        "+33 6 45 67 89 01", AppRole.USER,         teacherResearch);
        Identity luc    = createIdentity("Luc",     "Moreau",        "luc.moreau@univ-paris13.fr",          null,                AppRole.USER,         biatss);
        Identity fatima = createIdentity("Fatima",  "El Mansouri",   "fatima.elmansouri@univ-paris13.fr",   "+33 6 11 22 33 44", AppRole.USER,         phd);
        Identity marc   = createIdentity("Marc",    "Lefebvre",      "marc.lefebvre@univ-paris13.fr",       null,                AppRole.USER,         teacherResearch);

        // ─── Role assignments (effective-dated) ────────────────────────────────
        LocalDate now        = LocalDate.now();
        LocalDate oneYearAgo = now.minusYears(1);

        assignRole(achraf, itEngineer,     oneYearAgo,             null);
        assignRole(sophie, seniorLecturer, oneYearAgo,             null);
        assignRole(pierre, deptHead,       now.minusYears(2),      null);
        assignRole(amina,  fullProfessor,  now.minusYears(5),      null);
        assignRole(amina,  director,       now.minusYears(1),      null);
        assignRole(luc,    hrManager,      now.minusYears(2),      null);
        assignRole(marc,   seniorLecturer, now.minusYears(4),      null);
        assignRole(marc,   projectOfficer, now.minusMonths(6),     now.plusYears(1));

        // ─── Group configurators ───────────────────────────────────────────────
        iut.getConfigurators().add(pierre);
        groupRepository.save(iut);

        log.info("Demo data seeded: {} statuses, {} roles, {} groups, {} identities",
                statusRepository.count(), roleRepository.count(),
                groupRepository.count(), identityRepository.count());
    }

    private Status createStatus(String name, String description) {
        Status s = new Status();
        s.setName(name);
        s.setDescription(description);
        return statusRepository.save(s);
    }

    private Role createRole(String name, String description, Group group) {
        Role r = new Role();
        r.setName(name);
        r.setDescription(description);
        r.setGroup(group);
        return roleRepository.save(r);
    }

    private Group createGroup(String name) {
        Group g = new Group();
        g.setName(name);
        return groupRepository.save(g);
    }

    private Identity createIdentity(String firstName, String lastName, String email,
            String phone, AppRole role, Status status) {
        Identity i = new Identity();
        i.setFirstName(firstName);
        i.setLastName(lastName);
        i.setPrimaryEmail(email);
        i.setPhone(phone);
        i.setAppRole(role);
        i.setStatus(status);
        i.setPassword(passwordEncoder.encode("password"));
        i.setMustChangePassword(false);
        return identityRepository.save(i);
    }

    private void assignRole(Identity identity, Role role, LocalDate start, LocalDate end) {
        RoleAssignment ra = new RoleAssignment();
        ra.setIdentity(identity);
        ra.setRole(role);
        ra.setStartDate(start);
        ra.setEndDate(end);
        roleAssignmentRepository.save(ra);
    }
}
