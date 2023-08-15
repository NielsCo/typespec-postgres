CREATE TABLE IF NOT EXISTS Test();

ALTER TABLE IF EXISTS Test
    ADD COLUMN IF NOT EXISTS otherKey NUMERIC,
    ADD COLUMN IF NOT EXISTS myId NUMERIC,
    ADD PRIMARY KEY (otherKey, myId);