CREATE SCHEMA IF NOT EXISTS one;

CREATE SCHEMA IF NOT EXISTS two;

CREATE TABLE IF NOT EXISTS Foo();

CREATE TABLE IF NOT EXISTS one.Foo();

CREATE TABLE IF NOT EXISTS two.Foo();

ALTER TABLE IF EXISTS Foo ADD COLUMN IF NOT EXISTS myId TEXT NOT NULL;

ALTER TABLE IF EXISTS one.Foo
    ADD COLUMN IF NOT EXISTS myId TEXT NOT NULL;

ALTER TABLE IF EXISTS two.Foo
    ADD COLUMN IF NOT EXISTS myId TEXT NOT NULL;