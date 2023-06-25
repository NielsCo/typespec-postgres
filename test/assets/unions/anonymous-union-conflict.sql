CREATE TYPE WidgetColorEnum AS ENUM ('red', 'blue');

CREATE TYPE WidgetColorEnum_1 AS ENUM ('blue', 'green');

CREATE TABLE Widget (
    id TEXT NOT NULL,
    color WidgetColorEnum NOT NULL,
    Color WidgetColorEnum_1 NOT NULL
);