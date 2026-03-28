from api.models import Challenge


CHALLENGES = [
    {
        "title": "Customer Order Summary",
        "description": (
            "Write a query to find each customer's total number of orders "
            "and total spend. Return customer name, order count, and total amount."
        ),
        "difficulty": "easy",
        "schema_sql": (
            "CREATE TABLE customers (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  name VARCHAR(100) NOT NULL,\n"
            "  email VARCHAR(150),\n"
            "  region VARCHAR(50)\n"
            ");\n\n"
            "CREATE TABLE orders (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  customer_id INT REFERENCES customers(id),\n"
            "  amount NUMERIC(10,2),\n"
            "  order_date DATE\n"
            ");"
        ),
        "seed_sql": "-- Sample data inserted by sandbox",
        "ground_truth_query": (
            "SELECT c.name AS customer_name, COUNT(o.id) AS order_count, "
            "COALESCE(SUM(o.amount), 0) AS total_spend "
            "FROM customers c LEFT JOIN orders o ON o.customer_id = c.id "
            "GROUP BY c.id, c.name ORDER BY total_spend DESC;"
        ),
        "time_limit_ms": 5000,
    },
    {
        "title": "Top Products by Region",
        "description": (
            "Find the top 3 best-selling products in each region by revenue. "
            "Include ties."
        ),
        "difficulty": "easy",
        "schema_sql": (
            "CREATE TABLE products (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  name VARCHAR(100) NOT NULL,\n"
            "  price NUMERIC(10,2)\n"
            ");\n\n"
            "CREATE TABLE regions (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  name VARCHAR(50) NOT NULL\n"
            ");\n\n"
            "CREATE TABLE order_items (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  product_id INT REFERENCES products(id),\n"
            "  region_id INT REFERENCES regions(id),\n"
            "  quantity INT,\n"
            "  unit_price NUMERIC(10,2)\n"
            ");"
        ),
        "seed_sql": "-- Sample data inserted by sandbox",
        "ground_truth_query": (
            "SELECT * FROM ("
            "SELECT r.name AS region, p.name AS product, "
            "SUM(oi.quantity * oi.unit_price) AS revenue, "
            "RANK() OVER (PARTITION BY r.id ORDER BY SUM(oi.quantity * oi.unit_price) DESC) AS rnk "
            "FROM order_items oi "
            "JOIN products p ON p.id = oi.product_id "
            "JOIN regions r ON r.id = oi.region_id "
            "GROUP BY r.id, r.name, p.id, p.name"
            ") ranked WHERE rnk <= 3;"
        ),
        "time_limit_ms": 5000,
    },
    {
        "title": "Revenue Running Total",
        "description": (
            "Calculate a daily running total of revenue for the past year, "
            "partitioned by product category."
        ),
        "difficulty": "medium",
        "schema_sql": (
            "CREATE TABLE products (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  name VARCHAR(100) NOT NULL,\n"
            "  category VARCHAR(50) NOT NULL,\n"
            "  price NUMERIC(10,2)\n"
            ");\n\n"
            "CREATE TABLE orders (\n"
            "  id SERIAL PRIMARY KEY,\n"
            "  product_id INT REFERENCES products(id),\n"
            "  quantity INT,\n"
            "  order_date DATE\n"
            ");"
        ),
        "seed_sql": "-- Sample data inserted by sandbox",
        "ground_truth_query": (
            "SELECT p.category, o.order_date, "
            "SUM(o.quantity * p.price) AS daily_revenue, "
            "SUM(SUM(o.quantity * p.price)) OVER "
            "(PARTITION BY p.category ORDER BY o.order_date) AS running_total "
            "FROM orders o JOIN products p ON p.id = o.product_id "
            "WHERE o.order_date >= CURRENT_DATE - INTERVAL '1 year' "
            "GROUP BY p.category, o.order_date "
            "ORDER BY p.category, o.order_date;"
        ),
        "time_limit_ms": 10000,
    },
]


def run(stdout, style):
    if Challenge.objects.exists():
        stdout.write("  Challenges already exist, skipping.")
        return

    for data in CHALLENGES:
        Challenge.objects.create(**data)

    stdout.write(style.SUCCESS(f"  Created {len(CHALLENGES)} challenges"))
