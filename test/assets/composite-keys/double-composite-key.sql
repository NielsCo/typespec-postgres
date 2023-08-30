CREATE TABLE Test (
    oneMPId NUMERIC,
    oneMPAlsoId NUMERIC,
    PRIMARY KEY (oneMPId, oneMPAlsoId)
);

CREATE TABLE One (
    testMPOneMPId NUMERIC,
    testMPOneMPAlsoId NUMERIC,
    id NUMERIC,
    alsoId NUMERIC,
    PRIMARY KEY (id, alsoId)
);

ALTER TABLE
    Test
ADD
    FOREIGN KEY (oneMPId, oneMPAlsoId) REFERENCES One;

ALTER TABLE
    One
ADD
    FOREIGN KEY (testMPOneMPId, testMPOneMPAlsoId) REFERENCES Test;