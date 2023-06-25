CREATE TABLE myName (
    stringName VARCHAR(20) CHECK (LENGTH(stringName) <= 20)
);