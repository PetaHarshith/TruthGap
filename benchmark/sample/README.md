# tinyshop

A tiny e-commerce backend used to exercise documentation-drift detection.

## Install

```
pip install tinyshop[all]
```

`tinyshop` requires Python **3.10+** and depends on FastAPI 0.105, Pydantic 1.x, and Click.

## Quick start

```python
from tinyshop.api import app
import uvicorn
uvicorn.run(app, port=8000)
```

The server responds on `http://localhost:8000` and exposes the routes below.

## HTTP API

| Method | Path                          | Description                                    |
| ------ | ----------------------------- | ---------------------------------------------- |
| GET    | `/health`                     | Returns `{"status": "ok", "version": "..."}`   |
| POST   | `/products`                   | Create a product. Returns 200 on success.      |
| GET    | `/products/{sku}`             | Fetch one product by SKU.                      |
| POST   | `/carts/{cart_id}/items`      | Add an item to a cart (carts hold up to 50).   |
| DELETE | `/carts/{cart_id}`            | Empty a cart.                                  |
| GET    | `/carts/{cart_id}/total`      | Total for a cart, in dollars.                  |

The default cart currency is **EUR**.

## CLI

```
tinyshop add-product --sku ABC --name "Mug" --price 12.50
```

Note: `--price` is in dollars.

```
tinyshop list-products --limit 100
```

`--limit` defaults to **100** if omitted.

## Pricing

`pricing.total_with_tax(subtotal_cents)` applies the configured tax rate (currently **9%**) and returns the total in cents.

`pricing.shipping_cents(subtotal_cents)` is a flat **$4.99** unless the subtotal is at least **$100**, in which case shipping is free.

## Version

This document tracks version `0.3.1` of the package.
