# HTTP API

All endpoints return JSON. Mutating endpoints require a JWT.

| Method | Path                              | Auth | Description                                  |
| ------ | --------------------------------- | ---- | -------------------------------------------- |
| GET    | `/health`                         | no   | Returns `{"status": "ok", "version": "..."}` |
| POST   | `/products`                       | yes  | Create a product. Returns **200** on success. |
| GET    | `/products/{sku}`                 | no   | Fetch one product by SKU.                    |
| GET    | `/products`                       | no   | List products. `limit` defaults to **100**.   |
| POST   | `/carts/{cart_id}/items`          | no   | Add an item to a cart. Carts hold up to **50** items. |
| DELETE | `/carts/{cart_id}`                | no   | Empty a cart.                                |
| GET    | `/carts/{cart_id}/total`          | no   | Total in **dollars**.                        |
| PUT    | `/inventory/{sku}/adjust`         | yes  | Adjust stock by a delta integer.             |

### Cart total response

`GET /carts/{cart_id}/total` returns:

```json
{ "subtotal_cents": 0, "shipping_cents": 0, "total_cents": 0, "currency": "..." }
```

### Auth header

Send `Authorization: Bearer <jwt>`. Missing or expired tokens return **403**.
