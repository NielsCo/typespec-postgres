CREATE TYPE Breed AS ENUM (
    'beagle',
    'shepard',
    'GoldenRetriever',
    'diff'
);

CREATE TABLE Dog (breed Breed NOT NULL, name TEXT NOT NULL);