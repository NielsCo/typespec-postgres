CREATE SCHEMA one_two_three;

CREATE TYPE one_two_three.MyEnum AS ENUM ('test', 'test2');

CREATE TABLE Foo (myEnumValue one_two_three.MyEnum NOT NULL);