CREATE SCHEMA nested;

CREATE TYPE WidgetColorEnum AS ENUM ('red', 'blue');

CREATE TYPE nested.WidgetColorEnum AS ENUM ('red', 'blue', 'white');

CREATE TABLE Widget (color WidgetColorEnum NOT NULL);

CREATE TABLE nested.Widget (color nested.WidgetColorEnum NOT NULL);