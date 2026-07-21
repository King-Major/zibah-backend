-- 1. Create Enums for Roles and Order Statuses
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'SUPER_ADMIN', 'VENDOR', 'DRIVER', 'STORE_MANAGER');
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- 2. Create Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role DEFAULT 'CUSTOMER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Vendors Table (For email routing)
CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL
);

-- 5. Create Products Table (Linked to Category and Vendor)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    vendor_id INT REFERENCES vendors(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    is_digital BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Product Images Table (Supports 1 or multiple images per product)
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE
);

-- 7. Create Pickup Locations Table (With unique local location fees)
CREATE TABLE pickup_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    added_fee DECIMAL(10, 2) DEFAULT 0.00
);

-- 8. Create Orders Table (Linked to Paystack Reference)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    location_id INT REFERENCES pickup_locations(id) ON DELETE SET NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status order_status DEFAULT 'PENDING',
    paystack_ref VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Create Order Items Table (Logs purchase state and maps items back to vendors)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    vendor_id INT REFERENCES vendors(id) ON DELETE SET NULL,
    quantity INT NOT NULL,
    price_at_purchase DECIMAL(10, 2) NOT NULL
);

-- 10. Create Cart Table
CREATE TABLE cart (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    quantity INT DEFAULT 1,
    UNIQUE(user_id, product_id)
);

-- 11. Create Wishlist Table
CREATE TABLE wishlist (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
);