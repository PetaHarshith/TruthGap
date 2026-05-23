"""tinyshop command line interface."""
import click
import json


@click.group()
def main():
    """tinyshop CLI — manage inventory."""


@main.command()
@click.option("--sku", required=True, help="Product SKU")
@click.option("--name", required=True, help="Display name")
@click.option("--price", "price_cents", type=int, required=True, help="Price in CENTS, not dollars")
@click.option("--in-stock/--out-of-stock", default=True)
def add_product(sku: str, name: str, price_cents: int, in_stock: bool):
    """Add a single product to the catalog."""
    click.echo(json.dumps({"sku": sku, "name": name, "price_cents": price_cents, "in_stock": in_stock}))


@main.command()
@click.option("--limit", type=int, default=50, show_default=True)
def list_products(limit: int):
    """List products, newest first."""
    click.echo(f"(would list up to {limit} products)")


@main.command()
@click.argument("cart_id")
@click.option("--currency", default="USD", show_default=True)
def cart_total(cart_id: str, currency: str):
    """Show the total of a cart."""
    click.echo(f"cart={cart_id} currency={currency} total=0")
