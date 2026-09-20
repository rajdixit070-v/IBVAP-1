import ipaddress
import urllib.parse
from typing import Tuple, Optional

class SSRFValidator:
    """
    Validates outbound connection destinations (RTSP streams, edge nodes, webhooks)
    to protect against Server-Side Request Forgery (SSRF) and malicious stream tunneling.
    """

    # Dangerous IP ranges and hostnames
    FORBIDDEN_HOSTS = [
        "169.254.169.254",  # AWS/GCP/Azure Cloud Instance Metadata Service (IMDS)
        "metadata.google.internal",
        "instance-data",
        "127.0.0.1",
        "localhost",
        "0.0.0.0",
        "::1"
    ]

    ALLOWED_SCHEMES = ["rtsp", "rtsps", "http", "https", "synthetic", "test", "webcam", "device", "rtmp", "rtmps", "udp", "edge"]

    @classmethod
    def validate_destination_url(
        cls,
        url: str,
        allow_internal_subnets: bool = True
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates URL scheme, host, and IP.
        Returns (is_valid, error_reason).
        """
        if not url:
            return False, "Target URL cannot be empty."

        clean_url = url.strip()
        # Local webcams, browser edge nodes, and testing streams bypass remote network SSRF checks
        if clean_url.startswith(("webcam://", "device://", "edge://")) or clean_url.isdigit():
            return True, None

        if clean_url.startswith(("synthetic://", "test://")):
            return True, None

        try:
            parsed = urllib.parse.urlparse(clean_url)
        except Exception as e:
            return False, f"Malformed URL: {str(e)}"

        scheme = parsed.scheme.lower()
        if scheme not in cls.ALLOWED_SCHEMES:
            return False, f"Disallowed protocol scheme '{scheme}'. Supported: {', '.join(cls.ALLOWED_SCHEMES)}"

        # Drone UDP stream receivers listen locally on 0.0.0.0 or ground station ports
        if scheme == "udp":
            return True, None

        hostname = parsed.hostname
        if not hostname:
            return False, "URL must contain a valid hostname or IP address."

        hostname_lower = hostname.lower()

        # Check explicit forbidden hosts
        if hostname_lower in cls.FORBIDDEN_HOSTS:
            if allow_internal_subnets and hostname_lower in ("127.0.0.1", "localhost", "0.0.0.0", "::1"):
                pass  # Permitted for local testing, drone ground station, and mobile IP cameras
            else:
                return False, f"Security Violation: Target host '{hostname}' is strictly forbidden (Cloud Metadata / Loopback)."

        # Try parsing as IP address
        try:
            ip = ipaddress.ip_address(hostname)
            
            # Check for link-local / multicast / reserved
            if ip.is_link_local:
                return False, f"Security Violation: Link-local IP '{hostname}' (such as cloud metadata) is forbidden."
            if ip.is_multicast:
                return False, f"Multicast IP '{hostname}' is not a permitted stream destination."
            if ip.is_reserved:
                return False, f"Reserved IP address '{hostname}' is forbidden."

            # If local loopbacks are prohibited
            if not allow_internal_subnets and (ip.is_private or ip.is_loopback):
                return False, f"Private/Loopback IP '{hostname}' is disallowed by current policy."

        except ValueError:
            # Host is a DNS domain name
            if "169.254.169.254" in hostname_lower or "metadata" in hostname_lower:
                return False, "Domain names pointing to metadata services are forbidden."

        # Check port bounds
        if parsed.port is not None:
            if parsed.port < 1 or parsed.port > 65535:
                return False, f"Invalid port {parsed.port}."
            # Block well-known administrative ports if needed
            if parsed.port in [22, 23, 25, 3389]:
                return False, f"Port {parsed.port} is blocked for media streaming."

        return True, None
