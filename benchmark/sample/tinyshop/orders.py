"""Cart + checkout workflow."""
from pydantic import BaseModel

from .config import settings
from .inventory import _products
from .pricing import total_with_tax, shipping_cents


class Cart(BaseModel):
    items: list[str]
    currency: str = settings.default_currency


_carts: dict[str, Cart] = {}


def get_cart(cart_id: str) -> Cart:
    return _carts.setdefault(cart_id, Cart(items=[]))


def add_item(cart_id: str, sku: str) -> Cart:
    cart = get_cart(cart_id)
    if len(cart.items) >= settings.max_cart_items:
        raise ValueError("cart full")
    cart.items.append(sku)
    return cart


def clear(cart_id: str) -> None:
    _carts.pop(cart_id, None)


def total_cents(cart_id: str) -> dict:
    cart = _carts.get(cart_id)
    if cart is None:
        return {"subtotal_cents": 0, "shipping_cents": 0, "total_cents": 0}
    subtotal = sum(_products[s].price_cents for s in cart.items if s in _products)
    shipping = shipping_cents(subtotal)
    total = total_with_tax(subtotal) + shipping
    return {
        "subtotal_cents": subtotal,
        "shipping_cents": shipping,
        "total_cents": total,
        "currency": cart.currency,
    }
