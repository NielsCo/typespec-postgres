CREATE TABLE BaseModel (id NUMERIC PRIMARY KEY);

CREATE TABLE LevelOneModel (
    anotherProperty NUMERIC NOT NULL,
    id NUMERIC PRIMARY KEY
);

CREATE TABLE LevelTwoModel (
    yetAnotherProperty NUMERIC NOT NULL,
    anotherProperty NUMERIC NOT NULL,
    id NUMERIC PRIMARY KEY
);

CREATE TABLE referencesThemAll (
    baseId NUMERIC NOT NULL REFERENCES BaseModel,
    oneId NUMERIC NOT NULL REFERENCES LevelOneModel,
    twoId NUMERIC NOT NULL REFERENCES LevelTwoModel
);