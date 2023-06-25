CREATE TYPE WidgetColorEnum_1 AS ENUM ('green', 'blue');

CREATE TYPE WidgetColorEnum AS ENUM ('red', 'blue');

CREATE TABLE Widget (
    id TEXT NOT NULL,
    color WidgetColorEnum NOT NULL
);