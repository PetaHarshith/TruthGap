"""Pricing helpers."""
from decimal import Decimal

TAX_RATE = Decimal("0.0825")
FREE_SHIPPING_THRESHOLD_CENTS = 5000


def total_with_tax(subtotal_cents: int) -> int:
    """Return subtotal plus tax, rounded down to the nearest cent."""
    tax = Decimal(subtotal_cents) * TAX_RATE
    return int(Decimal(subtotal_cents) + tax)


def shipping_cents(subtotal_cents: int) -> int:
    """Flat $5.99 unless subtotal exceeds the free-shipping threshold."""
    if subtotal_cents >= FREE_SHIPPING_THRESHOLD_CENTS:
        return 0
    return 599
