CREATE TYPE MyEnum AS ENUM ('test', 'test2', 'test3');

CREATE TABLE Foo (myEnumValue MyEnum NOT NULL);