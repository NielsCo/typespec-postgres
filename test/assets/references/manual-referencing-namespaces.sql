CREATE SCHEMA one_two_three;

CREATE TABLE one_two_three.AnotherTest (
    test_id NUMERIC NOT NULL REFERENCES one_two_three.AnotherTest,
    myId NUMERIC PRIMARY KEY
);

CREATE TABLE Test (
    anotherTest NUMERIC NOT NULL REFERENCES one_two_three.AnotherTest
);