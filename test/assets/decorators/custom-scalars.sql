CREATE TABLE myName (
    varChar UUID CHECK (LENGTH(varChar) <= 20) NOT NULL
);