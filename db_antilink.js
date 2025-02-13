const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",    // atau alamat host MySQL kamu
  user: "root", // ganti dengan username MySQL kamu
  password: "", // ganti dengan password MySQL kamu
  database: "db_antilink",   // database baru yang sudah kamu buat
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
