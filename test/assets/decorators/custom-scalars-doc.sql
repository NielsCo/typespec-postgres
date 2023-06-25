CREATE TABLE myName (
    /* test.test, wow*/
    /* this is a doc-test */
    varChar UUID CHECK (LENGTH(varChar) <= 20) NOT NULL
);