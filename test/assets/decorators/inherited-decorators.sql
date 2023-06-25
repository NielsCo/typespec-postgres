CREATE TABLE Child1 (
    /* test.test, someExternalStuff*/
    /* anotherTest */
    someId1 UUID CHECK (LENGTH(someId1) > 30) NOT NULL,
    /* test.test, someExternalStuff*/
    /* myTest */
    id UUID CHECK (LENGTH(id) > 30) CHECK (LENGTH(id) <= 40) PRIMARY KEY
);

CREATE TABLE Child2 (
    /* test.test, someExternalStuff*/
    /* anotherTest */
    someId2 UUID CHECK (LENGTH(someId2) > 30) NOT NULL,
    /* test.test, someExternalStuff*/
    /* myTest */
    id UUID CHECK (LENGTH(id) > 30) CHECK (LENGTH(id) <= 40) PRIMARY KEY
);