CREATE TYPE WidgetKind AS ENUM ('Heavy', 'Light');

CREATE TYPE WidgetBaseColorEnum AS ENUM ('red', 'blue');

CREATE TABLE HeavyWidget (
    kind WidgetKind NOT NULL DEFAULT 'Heavy',
    id TEXT PRIMARY KEY,
    weight INTEGER NOT NULL,
    color WidgetBaseColorEnum NOT NULL
);

CREATE TABLE LightWidget (
    kind WidgetKind NOT NULL DEFAULT 'Light',
    id TEXT PRIMARY KEY,
    weight INTEGER NOT NULL,
    color WidgetBaseColorEnum NOT NULL
);