import pg from 'pg';

export const pgPool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://postgres:DigiBull@192.168.29.155:5432/logic_db',
});

export const fileMetadataPool = new pg.Pool({
  connectionString:
    process.env.FILE_METADATA_DB_URL ||
    'postgres://postgres:DigiBull@192.168.29.155:5432/file_metadata_db',
});