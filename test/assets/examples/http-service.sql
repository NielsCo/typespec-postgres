CREATE SCHEMA DemoService;

CREATE TYPE DemoService.WidgetColorEnum AS ENUM ('red', 'blue');

CREATE TABLE DemoService.Widget (
    id TEXT NOT NULL,
    weight INTEGER NOT NULL,
    color DemoService.WidgetColorEnum NOT NULL
);

CREATE TABLE DemoService.Error (
    code INTEGER NOT NULL,
    message TEXT NOT NULL
);