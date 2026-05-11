# Moteur IAM — Gestion des Identités et des Accès

Application web pédagogique de gestion des identités et des accès (IAM) pour l'Université Paris 13. Permet de gérer les personnels, leurs rôles dans les groupes et leurs statuts contractuels.

## Fonctionnalités

- **Annuaire des identités** — recherche paginée, filtres par statut et groupe, création/suppression
- **Gestion des rôles** — affectations temporelles avec dates de début/fin, historique complet
- **Groupes organisationnels** — hiérarchie de groupes, gestion des configurateurs
- **Statuts contractuels** — référentiel (BIATSS, Enseignant-Chercheur, Doctorant, etc.)
- **Trois niveaux d'accès** — ADMIN, CONFIGURATOR, USER
- **Carte d'identité numérique** — profil personnel avec historique des affectations
- **Mot de passe temporaire** — généré à la création, changé obligatoirement à la première connexion

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Spring Boot 3, Spring Security, Spring Data JPA |
| Base de données | H2 (in-memory, rechargée au démarrage) |
| Frontend | React 19, Vite, CSS natif |
| Auth | Sessions HTTP (cookie `JSESSIONID`) |
| API Docs | OpenAPI / Swagger UI |

## Démarrage rapide

**Prérequis :** Java 21+, Node.js 18+

```bash
# Terminal 1 — Backend
cd backend
./mvnw spring-boot:run
# → http://localhost:8080

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Comptes de démonstration

Mot de passe commun : `password`

| Email | Rôle | Notes |
|---|---|---|
| `admin@univ.fr` | ADMIN | Accès complet |
| `pierre.durand@univ-paris13.fr` | CONFIGURATOR | Chef de Département, gère IUT |
| `achraf.jdidi@univ-paris13.fr` | USER | Ingénieur informatique, DSI |
| `sophie.martin@univ-paris13.fr` | USER | Maître de Conférences, LIPN |
| `amina.benali@univ-paris13.fr` | USER | Professeur, UFR Sciences |

## Rôles et permissions

| Action | USER | CONFIGURATOR | ADMIN |
|---|:---:|:---:|:---:|
| Consulter l'annuaire | ✓ | ✓ | ✓ |
| Voir son profil | ✓ | ✓ | ✓ |
| Créer une identité | | ✓ | ✓ |
| Gérer les rôles de son groupe | | ✓ | ✓ |
| Gérer tous les groupes | | | ✓ |
| Supprimer une identité | | | ✓ |
| Modifier les rôles système | | | ✓ |
| Gérer les statuts | | | ✓ |

## Modèle de données

```
Identity ──── Status (BIATSS, Enseignant-Chercheur…)
    │
    └── RoleAssignment (startDate, endDate) ──── Role ──── Group
                                                               │
                                                        Group (parent)
```

Les affectations de rôles sont **horodatées** : une même personne peut avoir le même rôle sur plusieurs périodes distinctes. Une affectation sans `endDate` est considérée active.

## Structure du projet

```
iam/
├── backend/                         # Spring Boot
│   └── src/main/java/fr/univ/iam/
│       ├── controller/              # REST controllers (Identity, Group, Role, Status)
│       ├── service/                 # Logique métier (IamService, AuthorizationService…)
│       ├── repository/              # Spring Data JPA
│       ├── domain/                  # Entités JPA
│       ├── dto/                     # Records de transfert
│       └── security/                # SecurityConfig, UserDetailsService
└── frontend/                        # React + Vite
    └── src/
        ├── pages/                   # AdminPage, GroupsPage, UserPortal…
        ├── components/
        │   ├── business/            # IdentityList, IdentityDetail, SearchSelect
        │   └── ui/                  # ConfirmModal, Icons, ToastContext
        ├── services/api.js          # Appels HTTP centralisés
        └── utils/index.js           # getColor, getInitials, isActive, fmtDate
```

## Endpoints principaux

```
POST /api/v1/auth/login              — Connexion (→ cookie session)
GET  /api/v1/auth/me                 — Utilisateur connecté

GET  /api/v1/identities/snapshots    — Annuaire paginé avec rôles actifs
POST /api/v1/identities              — Créer une identité
POST /api/v1/identities/{id}/assignments/roles — Affecter un rôle
PATCH /api/v1/assignments/roles/{id}/terminate — Terminer une affectation

GET  /api/v1/groups                  — Liste des groupes
POST /api/v1/groups/{id}/configurators — Ajouter un configurateur

GET  /api/v1/stats                   — Compteurs globaux
```

Documentation interactive : [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)  
Console H2 (dev) : [http://localhost:8080/h2-console](http://localhost:8080/h2-console) — user `sa`, mot de passe vide

## Tests

```bash
cd backend

# Tous les tests (53 tests : unitaires + intégration)
./mvnw test

# Un test spécifique
./mvnw test -Dtest=IamServiceTest
./mvnw test -Dtest=AssignmentValidationServiceTest
./mvnw test -Dtest=IamControllerIntegrationTest
```

## Limitations connues

Ce projet est à vocation **pédagogique**. Points à ne pas reproduire en production :

- Base de données **in-memory** — les données sont perdues au redémarrage
- **CSRF désactivé** et console H2 accessible
- CORS limité à `localhost:5173`
