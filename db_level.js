// db_level.js
const mysql = require('mysql2/promise');

const poolLevel = mysql.createPool({
  host: 'localhost',
  user: 'root',         // Ganti dengan username MySQL Anda
  password: '', // Ganti dengan password MySQL Anda
  database: 'level_bot_whatsapp',  // Nama database untuk leveling
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = poolLevel;
