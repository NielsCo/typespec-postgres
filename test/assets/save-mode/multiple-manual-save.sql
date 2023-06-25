CREATE TABLE IF NOT EXISTS AnotherTest();

CREATE TABLE IF NOT EXISTS Test();

CREATE TABLE IF NOT EXISTS ReferenceBoth();

ALTER TABLE IF EXISTS AnotherTest
    ADD COLUMN IF NOT EXISTS myId NUMERIC PRIMARY KEY;

ALTER TABLE IF EXISTS Test
    ADD COLUMN IF NOT EXISTS anotherTest NUMERIC NOT NULL REFERENCES AnotherTest,
    ADD COLUMN IF NOT EXISTS myId NUMERIC PRIMARY KEY;

ALTER TABLE IF EXISTS ReferenceBoth
    ADD COLUMN IF NOT EXISTS anotherTest NUMERIC NOT NULL REFERENCES AnotherTest,
    ADD COLUMN IF NOT EXISTS test NUMERIC NOT NULL REFERENCES Test;