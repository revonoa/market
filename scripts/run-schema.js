const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    multipleStatements: true
  });
  try {
    await conn.query(sql);
    console.log('schema.sql executed.');
  } catch (e) {
    console.error('chema.sql failed:', e);
  } finally {
    await conn.end();
  }
})();
