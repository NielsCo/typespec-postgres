CREATE TABLE Anonymous_Model (
    value TEXT NOT NULL,
    anotherValue TEXT NOT NULL,
    andEvenMore TEXT PRIMARY KEY
);

CREATE TABLE test (
    testProperty TEXT NOT NULL REFERENCES Anonymous_Model
);