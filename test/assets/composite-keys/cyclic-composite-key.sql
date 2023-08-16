CREATE TABLE Test (
    otherKey NUMERIC,
    myId NUMERIC,
    oneId NUMERIC,
    oneAlsoId NUMERIC,
    PRIMARY KEY (otherKey, myId)
);

CREATE TABLE One (
    testOtherKey NUMERIC,
    testMyId NUMERIC,
    id NUMERIC,
    alsoId NUMERIC,
    PRIMARY KEY (id, alsoId)
);

ALTER TABLE
    Test
ADD
    FOREIGN KEY (oneId, oneAlsoId) REFERENCES One;

ALTER TABLE
    One
ADD
    FOREIGN KEY (testOtherKey, testMyId) REFERENCES Test;