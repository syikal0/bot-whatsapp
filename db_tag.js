// db_tag.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",          // Ganti dengan host MySQL kamu jika perlu
  user: "root",      // Ganti dengan username MySQL kamu
  password: "",  // Ganti dengan password MySQL kamu
  database: "db_tag",         // Gunakan database db_tag
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
