// import duckdb from 'duckdb';
// import path from 'node:path';
// import { log } from '../logger.js';

// let dbInstance: duckdb.Database | null = null;

// /**
//  * Initializes or returns the existing singleton DuckDB connection.
//  * Points to a persistent file relative to the root directory.
//  */
// export function getDuckDbConnection(): duckdb.Database {
//   if (dbInstance) {
//     return dbInstance;
//   }

//   // Define where your database file sits on disk
//   // e.g., C:\BuLLMQuote-SRIM\accomplish-ui\..\storage.duckdb
//   const dbPath = process.env.ACCOMPLISH_DUCKDB_PATH 
//     || path.join(process.cwd(), "C:\\Users\\ADMIN\\Downloads\\Bom_storage.duckdb");

//   log.info(`[DuckDB] Opening local storage database file at: ${dbPath}`);

//   try {
//     // Instantiating with a file path makes it persistent. 
//     // (Passing ':memory:' instead would make it an ephemeral in-memory DB).
//     dbInstance = new duckdb.Database(dbPath, err => {
//       if (err) {
//         log.error(`[DuckDB Fault] Failed to open database execution file: ${err.message}`);
//         throw err;
//       }
//       log.info('[DuckDB] Local storage engine connected successfully.');
//     });

//     return dbInstance;
//   } catch (error) {
//     log.error(`[DuckDB Initialization Error]: ${error}`);
//     throw error;
//   }
// }