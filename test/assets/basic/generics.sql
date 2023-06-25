CREATE TABLE Parent (workplace TEXT NOT NULL, id TEXT PRIMARY KEY);

CREATE TABLE Father (
    golfBallsInCollection SMALLINT NOT NULL,
    reference TEXT NOT NULL REFERENCES Parent
);

CREATE TABLE Child (school TEXT NOT NULL, id TEXT PRIMARY KEY);

CREATE TABLE Son (
    numberOfAirplanes NUMERIC NOT NULL,
    reference TEXT NOT NULL REFERENCES Child
);