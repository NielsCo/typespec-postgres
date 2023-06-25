CREATE TABLE IF NOT EXISTS BaseModel();

CREATE TABLE IF NOT EXISTS LevelOneModel();

CREATE TABLE IF NOT EXISTS LevelTwoModel();

CREATE TABLE IF NOT EXISTS referencesThemAll();

ALTER TABLE IF EXISTS BaseModel
    ADD COLUMN IF NOT EXISTS id NUMERIC PRIMARY KEY;

ALTER TABLE IF EXISTS LevelOneModel
    ADD COLUMN IF NOT EXISTS anotherProperty NUMERIC NOT NULL,
    ADD COLUMN IF NOT EXISTS id NUMERIC PRIMARY KEY;

ALTER TABLE IF EXISTS LevelTwoModel
    ADD COLUMN IF NOT EXISTS yetAnotherProperty NUMERIC NOT NULL,
    ADD COLUMN IF NOT EXISTS anotherProperty NUMERIC NOT NULL,
    ADD COLUMN IF NOT EXISTS id NUMERIC PRIMARY KEY;

ALTER TABLE IF EXISTS referencesThemAll
    ADD COLUMN IF NOT EXISTS base NUMERIC NOT NULL REFERENCES BaseModel,
    ADD COLUMN IF NOT EXISTS one NUMERIC NOT NULL REFERENCES LevelOneModel,
    ADD COLUMN IF NOT EXISTS two NUMERIC NOT NULL REFERENCES LevelTwoModel;