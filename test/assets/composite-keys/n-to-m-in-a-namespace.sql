CREATE SCHEMA MyTestName;

CREATE TABLE MyTestName.One (
    id NUMERIC PRIMARY KEY,
    test NUMERIC NOT NULL
);

CREATE TABLE MyTestName.Test (
    id NUMERIC PRIMARY KEY,
    one NUMERIC NOT NULL
);

CREATE TABLE MyTestName.One_Test (
    One_id NUMERIC,
    Test_id NUMERIC,
    PRIMARY KEY (One_id, Test_id)
);

ALTER TABLE
    MyTestName.One
ADD
    FOREIGN KEY (test) REFERENCES MyTestName.Test;

ALTER TABLE
    MyTestName.Test
ADD
    FOREIGN KEY (one) REFERENCES MyTestName.One;

ALTER TABLE
    MyTestName.One_Test
ADD
    FOREIGN KEY (One_id) REFERENCES MyTestName.One;

ALTER TABLE
    MyTestName.One_Test
ADD
    FOREIGN KEY (Test_id) REFERENCES MyTestName.Test;