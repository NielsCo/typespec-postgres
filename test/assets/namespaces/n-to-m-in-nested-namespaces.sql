CREATE SCHEMA MyTestName;

CREATE SCHEMA MyTestName_OtherNamespace;

CREATE TABLE MyTestName.Test (id NUMERIC PRIMARY KEY);

CREATE TABLE MyTestName_OtherNamespace.One (id NUMERIC PRIMARY KEY);

CREATE TABLE MyTestName_OtherNamespace.One_Test (
    One_id NUMERIC REFERENCES MyTestName_OtherNamespace.One,
    Test_id NUMERIC REFERENCES MyTestName.Test,
    PRIMARY KEY (One_id, Test_id)
);

CREATE TABLE MyTestName_OtherNamespace.One_Test_1 (
    test TEXT NOT NULL
);