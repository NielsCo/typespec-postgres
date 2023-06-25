CREATE TYPE TestColorEnum AS ENUM ('red', 'blue');

CREATE TABLE Test (color TestColorEnum NOT NULL);