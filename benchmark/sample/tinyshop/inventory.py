"""In-memory product / stock store."""
from pydantic import BaseModel


class Product(BaseModel):
    sku: str
    name: str
    price_cents: int
    in_stock: bool = True
    stock_count: int = 0


_products: dict[str, Product] = {}


def upsert(p: Product) -> Product:
    _products[p.sku] = p
    return p


def get(sku: str) -> Product | None:
    return _products.get(sku)


def all_products(limit: int = 50) -> list[Product]:
    return list(_products.values())[:limit]


def adjust_stock(sku: str, delta: int) -> Product | None:
    p = _products.get(sku)
    if p is None:
        return None
    new_count = max(0, p.stock_count + delta)
    p = p.model_copy(update={"stock_count": new_count, "in_stock": new_count > 0})
    _products[sku] = p
    return p
