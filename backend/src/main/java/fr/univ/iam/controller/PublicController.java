package fr.univ.iam.controller;

import fr.univ.iam.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicController {

    private final AppProperties appProperties;

    @GetMapping("/config")
    public ResponseEntity<AppConfigDto> getConfig() {
        AppProperties.University u = appProperties.getUniversity();
        return ResponseEntity.ok(new AppConfigDto(u.getName(), u.getShortName(), u.getAppName()));
    }

    public record AppConfigDto(String universityName, String universityShortName, String appName) {}
}
