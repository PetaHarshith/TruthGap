"""tinyshop command line interface."""
import click
import json

from .config import settings


@click.group()
def main():
    """tinyshop CLI — manage inventory and carts."""


@main.command()
@click.option("--sku", required=True, help="Product SKU")
@click.option("--name", required=True, help="Display name")
@click.option(
    "--price",
    "price_cents",
    type=int,
    required=True,
    help="Price in CENTS (not dollars).",
)
@click.option("--stock", type=int, default=0, show_default=True)
def add_product(sku: str, name: str, price_cents: int, stock: int):
    """Add a single product to the catalog."""
    click.echo(json.dumps({"sku": sku, "name": name, "price_cents": price_cents, "stock": stock}))


@main.command()
@click.option("--limit", type=int, default=50, show_default=True)
def list_products(limit: int):
    """List products."""
    click.echo(f"(would list up to {limit} products)")


@main.command()
@click.argument("cart_id")
def cart_total(cart_id: str):
    """Show the total of a cart in CENTS."""
    click.echo(f"cart={cart_id} currency={settings.default_currency} total=0")


@main.command()
@click.argument("user_id")
def issue_token(user_id: str):
    """Issue a JWT for the given user."""
    from .auth import issue_token as _issue

    click.echo(_issue(user_id))
