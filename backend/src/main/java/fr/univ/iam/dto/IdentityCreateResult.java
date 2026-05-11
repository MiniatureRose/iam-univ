package fr.univ.iam.dto;

import fr.univ.iam.domain.Identity;

public record IdentityCreateResult(Identity identity, String temporaryPassword) {}
