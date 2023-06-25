CREATE TYPE MyEnum AS ENUM ('test', 'test2', 'test3');

CREATE TABLE myName (myEnumValue MyEnum NOT NULL);