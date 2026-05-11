package fr.univ.iam.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.CONFLICT)
public class OverlapAssignmentException extends RuntimeException {

    public OverlapAssignmentException(String message) {
        super(message);
    }
}
