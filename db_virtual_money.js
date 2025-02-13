// db_virtual_money.js
const mysql = require('mysql2/promise');

const poolVirtualMoney = mysql.createPool({
  host: 'localhost',              // Ganti jika perlu
  user: 'root',        // Ganti dengan username MySQL Anda
  password: '',// Ganti dengan password MySQL Anda
  database: 'db_virtual_money',   // Nama database untuk uang virtual
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = poolVirtualMoney;
