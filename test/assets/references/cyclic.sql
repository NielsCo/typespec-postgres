CREATE TABLE AnotherTest (
    testReference NUMERIC NOT NULL,
    myId NUMERIC PRIMARY KEY
);

CREATE TABLE Test (
    anotherTestReference NUMERIC NOT NULL,
    myId NUMERIC PRIMARY KEY
);

ALTER TABLE
    AnotherTest
ADD
    FOREIGN KEY (testReference) REFERENCES Test;

ALTER TABLE
    Test
ADD
    FOREIGN KEY (anotherTestReference) REFERENCES AnotherTest;