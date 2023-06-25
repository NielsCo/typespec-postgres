CREATE TABLE NumericTypes (
    nu NUMERIC,
    inType NUMERIC,
    flo DOUBLE PRECISION,
    in64 BIGINT,
    in32 INTEGER,
    in16 SMALLINT,
    in8 SMALLINT CHECK (in8 >= -128 AND in8 <= 127),
    safe NUMERIC,
    uin64 NUMERIC CHECK (uin64 >= 0 AND uin64 <= 18446744073709551615),
    uin32 BIGINT CHECK (uin32 >= 0 AND uin32 <= 4294967295),
    uin16 INTEGER CHECK (uin16 >= 0 AND uin16 <= 65535),
    uin8 SMALLINT CHECK (uin8 >= 0 AND uin8 <= 255),
    flo32 REAL,
    flo64 DOUBLE PRECISION
);