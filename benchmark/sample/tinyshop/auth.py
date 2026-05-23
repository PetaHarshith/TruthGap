"""JWT-based authentication for tinyshop."""
import time
import jwt
from .config import settings

SECRET = "dev-secret-do-not-use-in-production"
ALGORITHM = "HS256"


def issue_token(user_id: str, scopes: list[str] | None = None) -> str:
    """Mint a JWT valid for settings.token_ttl_seconds."""
    payload = {
        "sub": user_id,
        "scopes": scopes or [],
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.token_ttl_seconds,
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    """Returns the decoded payload, or None if expired/invalid."""
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
