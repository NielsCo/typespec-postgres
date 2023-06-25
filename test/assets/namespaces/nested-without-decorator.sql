CREATE SCHEMA one_two_three;

CREATE SCHEMA this_can_be_very_nested_thing;

CREATE SCHEMA two;

CREATE TABLE Foo (myId TEXT NOT NULL);

CREATE TABLE one_two_three.Foo (myId TEXT NOT NULL);

CREATE TABLE this_can_be_very_nested_thing.Foo (myId TEXT NOT NULL);

CREATE TABLE two.Foo (myId TEXT NOT NULL);