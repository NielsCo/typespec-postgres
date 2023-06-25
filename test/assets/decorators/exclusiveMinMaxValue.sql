CREATE TABLE myName (
    myNumber INTEGER CHECK (myNumber > 20) CHECK (myNumber < 300) NOT NULL
);