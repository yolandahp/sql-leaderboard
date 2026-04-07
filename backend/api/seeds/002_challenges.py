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
        "seed_sql": (
            "INSERT INTO customers (name, email, region) VALUES\n"
            "  ('Alice', 'alice@example.com', 'North'),\n"
            "  ('Bob', 'bob@example.com', 'South'),\n"
            "  ('Charlie', 'charlie@example.com', 'North'),\n"
            "  ('Diana', 'diana@example.com', 'East'),\n"
            "  ('Eve', 'eve@example.com', 'West');\n\n"
            "INSERT INTO orders (customer_id, amount, order_date) VALUES\n"
            "  (1, 150.00, '2026-01-10'),\n"
            "  (1, 200.00, '2026-02-15'),\n"
            "  (1, 75.50, '2026-03-01'),\n"
            "  (2, 300.00, '2026-01-20'),\n"
            "  (2, 125.00, '2026-02-28'),\n"
            "  (3, 450.00, '2026-01-05'),\n"
            "  (3, 50.00, '2026-03-10'),\n"
            "  (4, 99.99, '2026-02-14'),\n"
            "  (4, 250.00, '2026-03-05'),\n"
            "  (4, 175.00, '2026-03-20');"
        ),
        "index_sql": (
            "CREATE INDEX idx_orders_customer_id ON orders(customer_id);\n"
            "CREATE INDEX idx_orders_date ON orders(order_date);"
        ),
        "seed_sql_large": (
            "SELECT setseed(0.42);\n\n"
            "-- 5000 customers\n"
            "INSERT INTO customers (name, email, region)\n"
            "SELECT 'Customer_' || i, 'user' || i || '@example.com',\n"
            "  (ARRAY['North','South','East','West'])[1 + (i % 4)]\n"
            "FROM generate_series(1, 5000) AS i\n"
            "ON CONFLICT (id) DO NOTHING;\n\n"
            "-- 500k orders\n"
            "INSERT INTO orders (customer_id, amount, order_date)\n"
            "SELECT (random() * 4999 + 1)::int,\n"
            "  (random() * 500)::numeric(10,2),\n"
            "  '2025-01-01'::date + (random() * 365)::int\n"
            "FROM generate_series(1, 500000);"
        ),
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
        "seed_sql": (
            "INSERT INTO products (name, price) VALUES\n"
            "  ('Laptop', 999.99),\n"
            "  ('Phone', 699.99),\n"
            "  ('Tablet', 449.99),\n"
            "  ('Monitor', 349.99),\n"
            "  ('Keyboard', 79.99),\n"
            "  ('Mouse', 29.99);\n\n"
            "INSERT INTO regions (name) VALUES\n"
            "  ('North'), ('South'), ('East');\n\n"
            "INSERT INTO order_items (product_id, region_id, quantity, unit_price) VALUES\n"
            "  (1, 1, 10, 999.99),\n"
            "  (2, 1, 25, 699.99),\n"
            "  (3, 1, 15, 449.99),\n"
            "  (4, 1, 8, 349.99),\n"
            "  (5, 1, 50, 79.99),\n"
            "  (1, 2, 5, 999.99),\n"
            "  (2, 2, 30, 699.99),\n"
            "  (3, 2, 20, 449.99),\n"
            "  (5, 2, 40, 79.99),\n"
            "  (6, 2, 100, 29.99),\n"
            "  (1, 3, 12, 999.99),\n"
            "  (4, 3, 18, 349.99),\n"
            "  (5, 3, 60, 79.99),\n"
            "  (6, 3, 80, 29.99);"
        ),
        "index_sql": (
            "CREATE INDEX idx_order_items_product ON order_items(product_id);\n"
            "CREATE INDEX idx_order_items_region ON order_items(region_id);"
        ),
        "seed_sql_large": (
            "SELECT setseed(0.42);\n\n"
            "-- 500 products\n"
            "INSERT INTO products (name, price)\n"
            "SELECT 'Product_' || i, (random() * 1000)::numeric(10,2)\n"
            "FROM generate_series(1, 500) AS i\n"
            "ON CONFLICT (id) DO NOTHING;\n\n"
            "-- 50 regions\n"
            "INSERT INTO regions (name)\n"
            "SELECT 'Region_' || i FROM generate_series(1, 50) AS i\n"
            "ON CONFLICT (id) DO NOTHING;\n\n"
            "-- 500k order items\n"
            "INSERT INTO order_items (product_id, region_id, quantity, unit_price)\n"
            "SELECT (random() * 499 + 1)::int,\n"
            "  (random() * 49 + 1)::int,\n"
            "  (random() * 50 + 1)::int,\n"
            "  (random() * 1000)::numeric(10,2)\n"
            "FROM generate_series(1, 500000);"
        ),
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
        "seed_sql": (
            "INSERT INTO products (name, category, price) VALUES\n"
            "  ('Laptop Pro', 'Electronics', 1299.99),\n"
            "  ('Wireless Mouse', 'Electronics', 29.99),\n"
            "  ('Desk Chair', 'Furniture', 399.99),\n"
            "  ('Standing Desk', 'Furniture', 599.99),\n"
            "  ('Python Book', 'Books', 49.99);\n\n"
            "INSERT INTO orders (product_id, quantity, order_date) VALUES\n"
            "  (1, 2, '2025-06-01'),\n"
            "  (1, 1, '2025-06-15'),\n"
            "  (2, 5, '2025-06-01'),\n"
            "  (2, 3, '2025-07-10'),\n"
            "  (3, 1, '2025-06-20'),\n"
            "  (3, 2, '2025-08-05'),\n"
            "  (4, 1, '2025-07-01'),\n"
            "  (4, 1, '2025-09-15'),\n"
            "  (5, 4, '2025-06-10'),\n"
            "  (5, 6, '2025-07-20'),\n"
            "  (1, 3, '2025-08-01'),\n"
            "  (2, 10, '2025-08-15'),\n"
            "  (3, 1, '2025-09-01'),\n"
            "  (5, 2, '2025-10-10');"
        ),
        "index_sql": (
            "CREATE INDEX idx_orders_product_id ON orders(product_id);\n"
            "CREATE INDEX idx_orders_date ON orders(order_date);"
        ),
        "seed_sql_large": (
            "SELECT setseed(0.42);\n\n"
            "-- 200 products\n"
            "INSERT INTO products (name, category, price)\n"
            "SELECT 'Product_' || i,\n"
            "  (ARRAY['Electronics','Furniture','Books','Sports','Food'])[1 + (i % 5)],\n"
            "  (random() * 500)::numeric(10,2)\n"
            "FROM generate_series(1, 200) AS i\n"
            "ON CONFLICT (id) DO NOTHING;\n\n"
            "-- 500k orders\n"
            "INSERT INTO orders (product_id, quantity, order_date)\n"
            "SELECT (random() * 199 + 1)::int,\n"
            "  (random() * 20 + 1)::int,\n"
            "  '2025-04-01'::date + (random() * 365)::int\n"
            "FROM generate_series(1, 500000);"
        ),
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

    from api.views.challenges import _materialize_challenge

    for data in CHALLENGES:
        challenge = Challenge.objects.create(**data)
        _materialize_challenge(challenge)

    stdout.write(style.SUCCESS(f"  Created {len(CHALLENGES)} challenges"))
