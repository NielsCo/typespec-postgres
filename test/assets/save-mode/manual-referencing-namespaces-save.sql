CREATE SCHEMA IF NOT EXISTS one_two_three;

CREATE TABLE IF NOT EXISTS one_two_three.AnotherTest();

CREATE TABLE IF NOT EXISTS Test();

ALTER TABLE IF EXISTS one_two_three.AnotherTest
    ADD COLUMN IF NOT EXISTS test_id NUMERIC NOT NULL REFERENCES one_two_three.AnotherTest,
    ADD COLUMN IF NOT EXISTS myId NUMERIC PRIMARY KEY;

ALTER TABLE IF EXISTS Test
    ADD COLUMN IF NOT EXISTS anotherTest NUMERIC NOT NULL REFERENCES one_two_three.AnotherTest;