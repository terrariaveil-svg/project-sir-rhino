import os
from pathlib import Path

import psycopg
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from psycopg.rows import dict_row

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

load_dotenv(BASE_DIR / ".env")

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("Missing DATABASE_URL in backend/.env")


def get_connection():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def validate_product(data):
    name = str(data.get("product_name", "")).strip()
    category = str(data.get("category", "")).strip()

    if not name or not category:
        return None, "Product name and category are required."

    try:
        price = float(data.get("price"))
        quantity = int(data.get("quantity"))

        if price < 0 or quantity < 0:
            return None, "Price and quantity cannot be negative."

        if quantity != float(data.get("quantity")):
            return None, "Quantity must be a whole number."

    except (TypeError, ValueError):
        return None, "Enter a valid price and quantity."

    return {
        "product_name": name,
        "category": category,
        "price": price,
        "quantity": quantity
    }, None


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/assets/<path:filename>")
def frontend_assets(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route("/style.css")
def frontend_stylesheet():
    return send_from_directory(FRONTEND_DIR, "style.css")


@app.route("/script.js")
def frontend_script():
    return send_from_directory(FRONTEND_DIR, "script.js")


@app.route("/api/products", methods=["GET"])
def get_products():
    search = request.args.get("search", "").strip()

    with get_connection() as connection:
        if search:
            result = connection.execute(
                """
                SELECT *
                FROM products
                WHERE product_name ILIKE %s
                ORDER BY product_id DESC
                """,
                (f"%{search}%",)
            )
        else:
            result = connection.execute(
                "SELECT * FROM products ORDER BY product_id DESC"
            )

        return jsonify(result.fetchall())


@app.route("/api/products", methods=["POST"])
def add_product():
    data, error = validate_product(request.get_json(silent=True) or {})

    if error:
        return jsonify({"error": error}), 400

    with get_connection() as connection:
        result = connection.execute(
            """
            INSERT INTO products (product_name, category, price, quantity)
            VALUES (%s, %s, %s, %s)
            RETURNING *
            """,
            (
                data["product_name"],
                data["category"],
                data["price"],
                data["quantity"]
            )
        )
        return jsonify(result.fetchone()), 201


@app.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    with get_connection() as connection:
        result = connection.execute(
            "SELECT * FROM products WHERE product_id = %s",
            (product_id,)
        )
        product = result.fetchone()

    if not product:
        return jsonify({"error": "Product not found"}), 404

    return jsonify(product)


@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    data, error = validate_product(request.get_json(silent=True) or {})

    if error:
        return jsonify({"error": error}), 400

    with get_connection() as connection:
        result = connection.execute(
            """
            UPDATE products
            SET product_name = %s, category = %s, price = %s, quantity = %s
            WHERE product_id = %s
            RETURNING *
            """,
            (
                data["product_name"],
                data["category"],
                data["price"],
                data["quantity"],
                product_id
            )
        )
        product = result.fetchone()

    if not product:
        return jsonify({"error": "Product not found"}), 404

    return jsonify(product)


@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    with get_connection() as connection:
        result = connection.execute(
            "DELETE FROM products WHERE product_id = %s RETURNING product_id",
            (product_id,)
        )
        deleted_product = result.fetchone()

    if not deleted_product:
        return jsonify({"error": "Product not found"}), 404

    return jsonify({"message": "Product deleted successfully"})


@app.route("/api/dashboard", methods=["GET"])
def dashboard():
    with get_connection() as connection:
        result = connection.execute(
            """
            SELECT
                COUNT(*) AS total_products,
                COALESCE(SUM(quantity), 0) AS total_stock,
                COALESCE(SUM(price * quantity), 0) AS inventory_value,
                COUNT(*) FILTER (
                    WHERE quantity BETWEEN 1 AND 10
                ) AS low_stock,
                COUNT(*) FILTER (
                    WHERE quantity = 0
                ) AS out_of_stock
            FROM products
            """
        )
        summary = result.fetchone()

    summary["inventory_value"] = float(summary["inventory_value"])
    return jsonify(summary)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=False)
