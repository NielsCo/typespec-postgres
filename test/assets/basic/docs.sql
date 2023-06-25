/* test.com*/
/* this is my test for enum */
CREATE TYPE MyEnum AS ENUM (
    /* test.com, test-enum1*/
    /* test the doc feature for enum1 */
    'test',
    /* test the doc feature for enum2 */
    'test2',
    /* test the doc feature for enum3 */
    'test3'
);

/* referenced Model */
CREATE TABLE ReferencedModel (
    /* key value */
    myId NUMERIC PRIMARY KEY
);

/* test.com, test-MyModel*/
/* this is a test */
CREATE TABLE MyModel (
    /* test.com, test-MyModel-someEntity*/
    /* this is a modelProperty test */
    someEntity TEXT NOT NULL,
    /* modelProperty for reference */
    reference NUMERIC NOT NULL REFERENCES ReferencedModel
);