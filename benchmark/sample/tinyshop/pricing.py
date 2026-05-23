"""Pricing helpers."""
from decimal import Decimal

from .config import settings


def total_with_tax(subtotal_cents: int) -> int:
    """Return subtotal plus tax, rounded down to the nearest cent."""
    tax = Decimal(subtotal_cents) * Decimal(settings.tax_rate_basis_points) / Decimal(10_000)
    return int(Decimal(subtotal_cents) + tax)


def shipping_cents(subtotal_cents: int) -> int:
    """Flat shipping unless subtotal exceeds the free-shipping threshold."""
    if subtotal_cents >= settings.free_shipping_threshold_cents:
        return 0
    return settings.flat_shipping_cents


def apply_discount(subtotal_cents: int, code: str) -> int:
    """Apply a discount code. Returns the new subtotal, or original if no match."""
    table = {"WELCOME10": 0.10, "SAVE20": 0.20}
    pct = table.get(code.upper())
    if pct is None:
        return subtotal_cents
    return int(subtotal_cents * (1 - pct))
