import os
import re
import uuid
from typing import Tuple, Optional, Dict, Any, List

class InputSanitizerService:
    """
    Input validation, path traversal defense, file upload security, and NoSQL/query sanitization.
    """

    ALLOWED_MIME_TYPES = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "application/pdf",
        "text/csv",
        "application/json"
    ]

    ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".pdf", ".csv", ".json"]
    MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

    # Dangerous NoSQL / MongoDB operator patterns
    FORBIDDEN_QUERY_OPERATORS = ["$where", "$regex", "$expr", "$function", "$accumulator"]

    @classmethod
    def sanitize_file_path(cls, user_filename: str, base_dir: str = "storage/evidence") -> Tuple[bool, str, Optional[str]]:
        """
        Protects against Directory / Path Traversal attacks (e.g. ../../etc/passwd, null bytes).
        Returns (is_safe, secure_target_path, error_reason).
        """
        if not user_filename:
            return False, "", "Filename cannot be empty."

        # Check for null bytes or control characters
        if "\0" in user_filename:
            return False, "", "Security Violation: Filename contains null byte."

        # Check for URL-encoded traversal patterns
        if "%2e%2e" in user_filename.lower() or "..\\" in user_filename or "../" in user_filename or ".." in user_filename:
            return False, "", "Security Violation: Directory traversal sequences ('..') are strictly prohibited."

        # Strip any leading slashes or Windows drive letters
        clean_name = os.path.basename(user_filename)
        clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', clean_name)

        if not clean_name:
            clean_name = f"file_{uuid.uuid4().hex[:8]}"

        abs_base_dir = os.path.abspath(base_dir)
        full_target_path = os.path.abspath(os.path.join(abs_base_dir, clean_name))

        # Ensure the resulting path resides strictly inside base_dir
        if not full_target_path.startswith(abs_base_dir):
            return False, "", "Security Violation: Path escapes authorized base directory."

        return True, full_target_path, None

    @classmethod
    def validate_file_upload(
        cls,
        filename: str,
        content_type: Optional[str],
        file_size_bytes: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates uploaded file MIME type, extension, and size limits.
        Returns (is_valid, error_reason).
        """
        if file_size_bytes > cls.MAX_FILE_SIZE_BYTES:
            return False, f"File size exceeds maximum limit of {cls.MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."

        _, ext = os.path.splitext(filename.lower())
        if ext not in cls.ALLOWED_EXTENSIONS:
            return False, f"Unsupported file extension '{ext}'. Permitted: {', '.join(cls.ALLOWED_EXTENSIONS)}"

        if content_type and content_type.lower() not in cls.ALLOWED_MIME_TYPES:
            return False, f"Disallowed MIME content type '{content_type}'."

        return True, None

    @classmethod
    def sanitize_query_filter(cls, query_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitizes filter dictionaries to prevent operator injection attacks.
        Removes dangerous operators such as $where or arbitrary code execution filters.
        """
        if not isinstance(query_dict, dict):
            return {}

        sanitized: Dict[str, Any] = {}
        for k, v in query_dict.items():
            if isinstance(k, str) and (k.startswith("$") or k in cls.FORBIDDEN_QUERY_OPERATORS):
                continue  # Strip unauthorized operator keys
            
            if isinstance(v, dict):
                sanitized[k] = cls.sanitize_query_filter(v)
            elif isinstance(v, list):
                sanitized[k] = [cls.sanitize_query_filter(item) if isinstance(item, dict) else item for item in v]
            else:
                sanitized[k] = v

        return sanitized
