CREATE TABLE TimeTypes (
    plainDat DATE,
    plainTim TIME WITHOUT TIME ZONE,
    utcDateTim TIMESTAMP WITH TIME ZONE,
    offsetDateTim TIMESTAMP WITH TIME ZONE,
    dur INTERVAL
);