# tinyshop CLI

Installed as the `tinyshop` console script. Run `tinyshop --help` to see all commands.

## Commands

### `tinyshop add-product`

Adds a product.

| Option        | Type   | Required | Default | Description                |
| ------------- | ------ | -------- | ------- | -------------------------- |
| `--sku`       | string | yes      | —       | Product SKU                |
| `--name`      | string | yes      | —       | Display name               |
| `--price`     | float  | yes      | —       | Price in **dollars**.      |
| `--stock`     | int    | no       | 10      | Initial stock count.        |

### `tinyshop list-products`

Lists products. `--limit` defaults to **100**.

### `tinyshop cart-total`

Prints the total for a cart in **dollars**.

```
tinyshop cart-total <cart_id>
```

### `tinyshop issue-token`

Issues a JWT for the given user. Tokens last **24 hours**.

```
tinyshop issue-token <user_id>
```
