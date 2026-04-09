from api.models import Challenge


CHALLENGE = {
    "title": "High-Value Customer Orders",
    "description": (
        "Find the top high-value customers in the North region who have at least 3 "
        "completed orders since mid-2024. Return their name, region, segment, order count, "
        "total revenue, and average order value, sorted by total revenue descending.\n\n"
        "This challenge has a large dataset (200k+ orders) — efficient use of indexes "
        "and join strategies will make a significant difference in execution time."
    ),
    "difficulty": "hard",
    "schema_sql": (
        "CREATE TABLE customers (\n"
        "    id SERIAL PRIMARY KEY,\n"
        "    name VARCHAR(100) NOT NULL,\n"
        "    email VARCHAR(150),\n"
        "    region VARCHAR(50),\n"
        "    segment VARCHAR(20),\n"
        "    created_at DATE\n"
        ");\n\n"
        "CREATE TABLE products (\n"
        "    id SERIAL PRIMARY KEY,\n"
        "    name VARCHAR(100) NOT NULL,\n"
        "    category VARCHAR(50),\n"
        "    price NUMERIC(10,2)\n"
        ");\n\n"
        "CREATE TABLE orders (\n"
        "    id SERIAL PRIMARY KEY,\n"
        "    customer_id INT REFERENCES customers(id),\n"
        "    product_id INT REFERENCES products(id),\n"
        "    quantity INT,\n"
        "    total_amount NUMERIC(10,2),\n"
        "    status VARCHAR(20),\n"
        "    order_date DATE\n"
        ");"
    ),
    "seed_sql": (
        "INSERT INTO customers (name, email, region, segment, created_at) VALUES\n"
        "  ('Alice Johnson', 'alice@example.com', 'North', 'Enterprise', '2023-03-15'),\n"
        "  ('Bob Smith', 'bob@example.com', 'South', 'SMB', '2023-06-20'),\n"
        "  ('Charlie Brown', 'charlie@example.com', 'East', 'Startup', '2023-09-01'),\n"
        "  ('Diana Prince', 'diana@example.com', 'West', 'Individual', '2023-12-10'),\n"
        "  ('Eve Davis', 'eve@example.com', 'North', 'Enterprise', '2024-01-05'),\n"
        "  ('Frank Miller', 'frank@example.com', 'Central', 'SMB', '2024-02-14'),\n"
        "  ('Grace Lee', 'grace@example.com', 'North', 'Startup', '2024-03-20'),\n"
        "  ('Hank Wilson', 'hank@example.com', 'South', 'Individual', '2024-04-01'),\n"
        "  ('Ivy Chen', 'ivy@example.com', 'East', 'Enterprise', '2024-05-15'),\n"
        "  ('Jack Taylor', 'jack@example.com', 'West', 'SMB', '2024-06-30'),\n"
        "  ('Karen White', 'karen@example.com', 'North', 'Enterprise', '2024-07-10'),\n"
        "  ('Leo Garcia', 'leo@example.com', 'Central', 'Startup', '2024-08-22'),\n"
        "  ('Mia Robinson', 'mia@example.com', 'South', 'Individual', '2024-09-05'),\n"
        "  ('Noah Martinez', 'noah@example.com', 'East', 'SMB', '2024-10-18'),\n"
        "  ('Olivia Anderson', 'olivia@example.com', 'North', 'Enterprise', '2024-11-01'),\n"
        "  ('Paul Thomas', 'paul@example.com', 'West', 'Startup', '2024-11-15'),\n"
        "  ('Quinn Jackson', 'quinn@example.com', 'Central', 'Individual', '2024-12-01'),\n"
        "  ('Ruby Harris', 'ruby@example.com', 'North', 'SMB', '2024-12-20'),\n"
        "  ('Sam Clark', 'sam@example.com', 'South', 'Enterprise', '2025-01-10'),\n"
        "  ('Tina Lewis', 'tina@example.com', 'East', 'Startup', '2025-02-01');\n\n"
        "INSERT INTO products (name, category, price) VALUES\n"
        "  ('Laptop Pro', 'Electronics', 1299.99),\n"
        "  ('Wireless Mouse', 'Electronics', 29.99),\n"
        "  ('Running Shoes', 'Sports', 89.99),\n"
        "  ('Desk Chair', 'Home', 399.99),\n"
        "  ('Python Cookbook', 'Books', 49.99),\n"
        "  ('Protein Bars', 'Food', 24.99),\n"
        "  ('Yoga Mat', 'Sports', 35.99),\n"
        "  ('LED Monitor', 'Electronics', 349.99),\n"
        "  ('Coffee Maker', 'Home', 79.99),\n"
        "  ('Vitamin C', 'Health', 14.99),\n"
        "  ('Car Charger', 'Auto', 19.99),\n"
        "  ('Winter Jacket', 'Clothing', 149.99),\n"
        "  ('Bluetooth Speaker', 'Electronics', 69.99),\n"
        "  ('Hiking Boots', 'Sports', 129.99),\n"
        "  ('Standing Desk', 'Home', 599.99),\n"
        "  ('SQL Handbook', 'Books', 39.99),\n"
        "  ('Energy Drinks', 'Food', 19.99),\n"
        "  ('Dumbbells', 'Sports', 59.99),\n"
        "  ('First Aid Kit', 'Health', 29.99),\n"
        "  ('Tire Pump', 'Auto', 34.99);\n\n"
        "INSERT INTO orders (customer_id, product_id, quantity, total_amount, status, order_date) VALUES\n"
        "  (1, 1, 1, 1299.99, 'completed', '2024-06-10'),\n"
        "  (1, 8, 2, 699.98, 'completed', '2024-07-15'),\n"
        "  (1, 4, 1, 399.99, 'completed', '2024-08-20'),\n"
        "  (1, 15, 1, 599.99, 'shipped', '2024-09-01'),\n"
        "  (2, 3, 2, 179.98, 'completed', '2024-06-05'),\n"
        "  (2, 12, 1, 149.99, 'pending', '2024-07-10'),\n"
        "  (3, 5, 3, 149.97, 'completed', '2024-06-20'),\n"
        "  (5, 1, 1, 1299.99, 'completed', '2024-06-15'),\n"
        "  (5, 13, 2, 139.98, 'completed', '2024-07-20'),\n"
        "  (5, 9, 1, 79.99, 'completed', '2024-08-25'),\n"
        "  (5, 2, 3, 89.97, 'cancelled', '2024-09-10'),\n"
        "  (7, 7, 1, 35.99, 'completed', '2024-06-01'),\n"
        "  (7, 18, 2, 119.98, 'completed', '2024-07-05'),\n"
        "  (7, 14, 1, 129.99, 'returned', '2024-08-15'),\n"
        "  (11, 1, 1, 1299.99, 'completed', '2024-08-01'),\n"
        "  (11, 4, 1, 399.99, 'completed', '2024-09-15'),\n"
        "  (11, 15, 1, 599.99, 'completed', '2024-10-20'),\n"
        "  (11, 8, 1, 349.99, 'shipped', '2024-11-01'),\n"
        "  (15, 16, 2, 79.98, 'completed', '2024-07-01'),\n"
        "  (15, 5, 1, 49.99, 'completed', '2024-08-10');"
    ),
    "index_sql": (
        "CREATE INDEX idx_customers_region_covering ON customers(region) INCLUDE (id, name, segment);\n"
        "CREATE INDEX idx_orders_cust_status_date ON orders(customer_id, status, order_date) INCLUDE (id, total_amount);"
    ),
    "seed_sql_large": (
        "SELECT setseed(0.42);\n\n"
        "-- 5000 customers\n"
        "INSERT INTO customers (name, email, region, segment, created_at)\n"
        "SELECT 'Customer_' || i,\n"
        "  'customer' || i || '@example.com',\n"
        "  (ARRAY['North','South','East','West','Central'])[1 + (i % 5)],\n"
        "  (ARRAY['Enterprise','SMB','Startup','Individual'])[1 + (i % 4)],\n"
        "  '2023-01-01'::date + (random() * 730)::int\n"
        "FROM generate_series(1, 5000) AS i;\n\n"
        "-- 500 products\n"
        "INSERT INTO products (name, category, price)\n"
        "SELECT 'Product_' || i,\n"
        "  (ARRAY['Electronics','Clothing','Books','Food','Sports','Home','Auto','Health'])[1 + (i % 8)],\n"
        "  (random() * 500 + 5)::numeric(10,2)\n"
        "FROM generate_series(1, 500) AS i;\n\n"
        "-- 500,000 orders\n"
        "INSERT INTO orders (customer_id, product_id, quantity, total_amount, status, order_date)\n"
        "SELECT\n"
        "  (random() * 4999 + 1)::int,\n"
        "  (random() * 499 + 1)::int,\n"
        "  (random() * 10 + 1)::int,\n"
        "  (random() * 1000 + 10)::numeric(10,2),\n"
        "  (ARRAY['completed','pending','shipped','cancelled','returned'])[1 + (random() * 4)::int],\n"
        "  '2024-01-01'::date + (random() * 365)::int\n"
        "FROM generate_series(1, 500000);"
    ),
    "ground_truth_query": (
        "SELECT c.name AS customer_name, c.region, c.segment,\n"
        "    COUNT(o.id) AS order_count,\n"
        "    SUM(o.total_amount) AS total_revenue,\n"
        "    AVG(o.total_amount) AS avg_order_value\n"
        "FROM customers c\n"
        "JOIN orders o ON o.customer_id = c.id\n"
        "WHERE o.status = 'completed'\n"
        "    AND o.order_date >= '2024-06-01'\n"
        "    AND c.region = 'North'\n"
        "GROUP BY c.id, c.name, c.region, c.segment\n"
        "HAVING COUNT(o.id) >= 3\n"
        "ORDER BY total_revenue DESC\n"
        "LIMIT 20;"
    ),
    "time_limit_ms": 10000,
}


def run(stdout, style):
    if Challenge.objects.filter(title=CHALLENGE["title"]).exists():
        stdout.write("  'High-Value Customer Orders' challenge already exists, skipping.")
        return

    from api.views.challenges import _materialize_challenge

    challenge = Challenge.objects.create(**CHALLENGE)
    _materialize_challenge(challenge)

    stdout.write(style.SUCCESS("  Created 'High-Value Customer Orders' challenge"))
