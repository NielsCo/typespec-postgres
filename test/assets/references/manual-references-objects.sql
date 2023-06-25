CREATE TABLE Anonymous_Model_1 (what TEXT PRIMARY KEY);

CREATE TABLE Anonymous_Model (
    anObject TEXT PRIMARY KEY,
    test TEXT NOT NULL REFERENCES Anonymous_Model_1
);

CREATE TABLE Test (id TEXT PRIMARY KEY REFERENCES Anonymous_Model);

CREATE TABLE AutomaticTest (
    testReference TEXT NOT NULL REFERENCES Test
);