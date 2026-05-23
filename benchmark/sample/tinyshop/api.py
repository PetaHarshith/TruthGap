"""HTTP API for tinyshop."""
from fastapi import FastAPI, HTTPException, Header
from typing import Optional

from . import __version__
from .auth import verify_token
from .config import settings
from .inventory import Product, upsert, get, all_products, adjust_stock
from .orders import add_item, clear, total_cents

app = FastAPI(title="tinyshop", version=__version__)


def _require_auth(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    payload = verify_token(authorization.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="invalid token")
    return payload


@app.get("/health")
def health():
    return {"status": "ok", "version": __version__}


@app.post("/products", status_code=201)
def create_product(p: Product, authorization: Optional[str] = Header(None)):
    _require_auth(authorization)
    if get(p.sku):
        raise HTTPException(status_code=409, detail="sku exists")
    return upsert(p)


@app.get("/products/{sku}")
def get_product(sku: str):
    p = get(sku)
    if not p:
        raise HTTPException(status_code=404, detail="product not found")
    return p


@app.get("/products")
def list_products(limit: int = 50):
    return all_products(limit=limit)


@app.post("/carts/{cart_id}/items")
def cart_add_item(cart_id: str, sku: str):
    try:
        return add_item(cart_id, sku)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/carts/{cart_id}")
def cart_clear(cart_id: str):
    clear(cart_id)
    return {"ok": True}


@app.get("/carts/{cart_id}/total")
def cart_total(cart_id: str) -> dict:
    return total_cents(cart_id)


@app.post("/inventory/{sku}/adjust")
def inventory_adjust(sku: str, delta: int, authorization: Optional[str] = Header(None)):
    _require_auth(authorization)
    p = adjust_stock(sku, delta)
    if not p:
        raise HTTPException(status_code=404)
    return p


@app.get("/config")
def config():
    return {
        "default_currency": settings.default_currency,
        "max_cart_items": settings.max_cart_items,
        "rate_limit_per_minute": settings.rate_limit_per_minute,
    }
