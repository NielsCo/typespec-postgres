CREATE TABLE IF NOT EXISTS AnotherTest();

ALTER TABLE IF EXISTS AnotherTest
    ADD COLUMN IF NOT EXISTS test_id NUMERIC NOT NULL REFERENCES AnotherTest,
    ADD COLUMN IF NOT EXISTS myId NUMERIC PRIMARY KEY;