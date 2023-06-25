CREATE TABLE AnotherTest (
    testReference NUMERIC NOT NULL,
    myId NUMERIC PRIMARY KEY
);

CREATE TABLE Test (
    anotherTestReference NUMERIC NOT NULL,
    myId NUMERIC PRIMARY KEY
);

CREATE TABLE ReferenceBoth (
    anotherTest NUMERIC NOT NULL,
    test NUMERIC NOT NULL
);

ALTER TABLE
    AnotherTest
ADD
    FOREIGN KEY (testReference) REFERENCES Test;

ALTER TABLE
    Test
ADD
    FOREIGN KEY (anotherTestReference) REFERENCES AnotherTest;

ALTER TABLE
    ReferenceBoth
ADD
    FOREIGN KEY (anotherTest) REFERENCES AnotherTest;

ALTER TABLE
    ReferenceBoth
ADD
    FOREIGN KEY (test) REFERENCES Test;