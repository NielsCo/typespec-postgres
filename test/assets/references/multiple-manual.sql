CREATE TABLE AnotherTest (myId NUMERIC PRIMARY KEY);

CREATE TABLE Test (
    anotherTest NUMERIC NOT NULL REFERENCES AnotherTest,
    myId NUMERIC PRIMARY KEY
);

CREATE TABLE ReferenceBoth (
    anotherTest NUMERIC NOT NULL REFERENCES AnotherTest,
    test NUMERIC NOT NULL REFERENCES Test
);