"""Runtime configuration for tinyshop."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    default_currency: str = "USD"
    max_cart_items: int = 25
    free_shipping_threshold_cents: int = 5000
    flat_shipping_cents: int = 599
    tax_rate_basis_points: int = 825  # 8.25%
    rate_limit_per_minute: int = 60
    token_ttl_seconds: int = 3600  # 1 hour
    server_port: int = 8000


settings = Settings()
