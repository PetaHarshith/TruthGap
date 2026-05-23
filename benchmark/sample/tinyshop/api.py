"""HTTP API for tinyshop."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="tinyshop", version="0.4.2")

DEFAULT_CURRENCY = "USD"
MAX_CART_ITEMS = 25


class Product(BaseModel):
    sku: str
    name: str
    price_cents: int
    in_stock: bool = True


class Cart(BaseModel):
    items: list[str]
    currency: str = DEFAULT_CURRENCY


_products: dict[str, Product] = {}
_carts: dict[str, Cart] = {}


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.4.2"}


@app.post("/products")
def create_product(p: Product):
    if p.sku in _products:
        raise HTTPException(status_code=409, detail="sku exists")
    _products[p.sku] = p
    return p


@app.get("/products/{sku}")
def get_product(sku: str):
    p = _products.get(sku)
    if not p:
        raise HTTPException(status_code=404, detail="product not found")
    return p


@app.put("/carts/{cart_id}/items")
def add_to_cart(cart_id: str, sku: str):
    cart = _carts.setdefault(cart_id, Cart(items=[]))
    if len(cart.items) >= MAX_CART_ITEMS:
        raise HTTPException(status_code=400, detail="cart full")
    cart.items.append(sku)
    return cart


@app.delete("/carts/{cart_id}")
def clear_cart(cart_id: str):
    _carts.pop(cart_id, None)
    return {"ok": True}


@app.get("/carts/{cart_id}/total")
def cart_total(cart_id: str, currency: Optional[str] = None) -> dict:
    cart = _carts.get(cart_id)
    if not cart:
        raise HTTPException(status_code=404)
    total = sum(_products[sku].price_cents for sku in cart.items if sku in _products)
    return {"cents": total, "currency": currency or cart.currency}
