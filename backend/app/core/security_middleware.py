from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response
import logging

logger = logging.getLogger("ibvap.security.middleware")

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injects enterprise-grade HTTP security headers on all API and WebSocket responses.
    """

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        path = request.url.path
        is_media = any(path.endswith(s) for s in ["/live", "/snapshot", "/preview", "/stream"]) or "/ws" in path

        # Standard Zero-Trust Security Headers
        if not is_media:
            response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy for API / Web
        if not is_media and "Content-Security-Policy" not in response.headers:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "img-src * data: blob:; "
                "style-src 'self' 'unsafe-inline'; "
                "script-src 'self' 'unsafe-inline'; "
                "connect-src * ws: wss:;"
            )

        return response
