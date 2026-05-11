package fr.univ.iam.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private University university = new University();
    private String corsAllowedOrigins = "http://localhost:5173";

    public List<String> getCorsAllowedOriginsList() {
        return Arrays.stream(corsAllowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Getter
    @Setter
    public static class University {
        private String name = "Université";
        private String shortName = "U";
        private String appName = "IAM";
    }
}
