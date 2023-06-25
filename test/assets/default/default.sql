CREATE TYPE MyEnum AS ENUM ('test1', 'test2', 'test3');

CREATE TABLE products (
    product_no INTEGER DEFAULT 20,
    something BOOLEAN DEFAULT false,
    name VARCHAR(100) CHECK (LENGTH(name) <= 100) DEFAULT 'text',
    price NUMERIC DEFAULT 9.99,
    enumValue MyEnum DEFAULT 'test1'
);