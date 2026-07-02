// import { getDuckDbConnection } from './duckdb-setup.js';

// export async function getBomItemsByRfq(rfqId: string): Promise<Record<string, unknown>[]> {
//   const db = getDuckDbConnection();
  
//   return new Promise((resolve, reject) => {
//     db.all(
//       `SELECT * FROM bom_items WHERE rfq_id = ?`,
//       [rfqId],
//       (err, rows) => {
//         if (err) return reject(err);
//         resolve(rows as Record<string, unknown>[]);
//       }
//     );
//   });
// }