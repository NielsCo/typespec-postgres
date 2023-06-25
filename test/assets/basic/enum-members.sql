CREATE TYPE Test AS ENUM ('10', '100', '1000');

CREATE TABLE UsesTest (
    value Test NOT NULL DEFAULT '10',
    valueTwo Test NOT NULL DEFAULT '100',
    valueThree Test NOT NULL DEFAULT '1000'
);