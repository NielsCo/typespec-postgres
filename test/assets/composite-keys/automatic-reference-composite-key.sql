CREATE TABLE Test (
    otherKey NUMERIC,
    myId NUMERIC,
    PRIMARY KEY (otherKey, myId)
);

CREATE TABLE OtherTest (
    testOtherKey NUMERIC,
    testMyId NUMERIC,
    FOREIGN KEY (testOtherKey, testMyId) REFERENCES Test
);