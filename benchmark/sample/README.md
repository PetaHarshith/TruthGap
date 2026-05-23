# tinyshop

A tiny e-commerce backend used to exercise documentation-drift detection.

## Install

```
pip install tinyshop[all]
```

`tinyshop` requires Python **3.10+** and depends on FastAPI 0.105, Pydantic 1.x, Click, and PyJWT.

## Quick start

```python
from tinyshop.api import app
import uvicorn
uvicorn.run(app, port=8080)
```

The server listens on **port 8080 by default** and exposes the routes documented in [docs/api.md](docs/api.md).

## CLI

See [docs/cli.md](docs/cli.md) for the full command reference.

```
tinyshop add-product --sku ABC --name "Mug" --price 12.50
tinyshop list-products --limit 100
tinyshop cart-total my-cart
```

Note: `--price` is in **dollars**.
`--limit` defaults to **100** if omitted.

## Pricing

`pricing.total_with_tax(subtotal_cents)` applies a **9%** tax and returns the total in cents.

`pricing.shipping_cents(subtotal_cents)` is a flat **$4.99** unless the subtotal is at least **$100**, in which case shipping is free.

Discount codes recognised by `pricing.apply_discount`: `WELCOME10` (10% off), `SAVE15` (15% off).

## Authentication

Protected endpoints require a JWT in the `Authorization: Bearer <token>` header. Tokens are valid for **24 hours** and are signed with the package secret.

## Configuration

The defaults below can be overridden via the `Settings` object:

| Setting               | Default |
|-----------------------|---------|
| `default_currency`    | `EUR`   |
| `max_cart_items`      | `50`    |
| `rate_limit_per_minute` | `100` |

## Version

This document tracks version `0.5.1` of the package.
