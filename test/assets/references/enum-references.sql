CREATE TYPE MyEnum AS ENUM ('a', 'b');

CREATE TABLE Test (my MyEnum PRIMARY KEY);

CREATE TABLE AnotherTest (
    testReference MyEnum NOT NULL REFERENCES Test
);