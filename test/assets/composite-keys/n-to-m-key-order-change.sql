CREATE TABLE Test (id NUMERIC PRIMARY KEY);

CREATE TABLE One (id NUMERIC PRIMARY KEY);

CREATE TABLE One_Test (
    One_id NUMERIC REFERENCES One,
    Test_id NUMERIC REFERENCES Test,
    PRIMARY KEY (One_id, Test_id)
);