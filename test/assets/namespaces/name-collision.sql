CREATE SCHEMA one;

CREATE SCHEMA two;

CREATE TABLE Foo (myId TEXT NOT NULL);

CREATE TABLE one.Foo (myId TEXT NOT NULL);

CREATE TABLE two.Foo (myId TEXT NOT NULL);