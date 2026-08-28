import re
from typing import List, Tuple

class PasswordPolicyService:
    """Enterprise password complexity, length, and reuse policy validation."""

    MIN_LENGTH = 8
    MAX_LENGTH = 128
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGIT = True
    REQUIRE_SPECIAL = True

    SPECIAL_CHAR_PATTERN = r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/`~]'

    @classmethod
    def validate_password(cls, password: str, username: str = "") -> Tuple[bool, List[str], int]:
        """
        Validates password against complexity rules and returns (is_valid, errors, score_0_to_100).
        """
        errors: List[str] = []
        score = 0

        if not password:
            return False, ["Password cannot be empty."], 0

        # Length check
        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters long.")
        elif len(password) > cls.MAX_LENGTH:
            errors.append(f"Password cannot exceed {cls.MAX_LENGTH} characters.")
        else:
            score += 25

        # Lowercase check
        if cls.REQUIRE_LOWERCASE and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter.")
        else:
            score += 20

        # Uppercase check
        if cls.REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter.")
        else:
            score += 20

        # Digit check
        if cls.REQUIRE_DIGIT and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one numerical digit (0-9).")
        else:
            score += 20

        # Special character check
        if cls.REQUIRE_SPECIAL and not re.search(cls.SPECIAL_CHAR_PATTERN, password):
            errors.append("Password must contain at least one special character (!@#$%^&*...).")
        else:
            score += 15

        # Username containment check
        if username and username.lower() in password.lower() and len(username) >= 3:
            errors.append("Password cannot contain your username.")
            score = max(0, score - 30)

        is_valid = len(errors) == 0
        return is_valid, errors, score
