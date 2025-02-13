const fs = require('fs');

// Membaca database dari file database.json
let db = {};
try {
  db = JSON.parse(fs.readFileSync('./database.json', 'utf-8'));
} catch (error) {
  console.log("Database tidak ditemukan, membuat database baru...");
  fs.writeFileSync('./database.json', JSON.stringify({}, null, 2));
}

// Fungsi untuk mengambil saldo pengguna
function getSaldo(userId) {
  return db[userId]?.saldo || 0;
}

// Fungsi untuk menambahkan saldo
function tambahSaldo(userId, jumlah) {
  if (!db[userId]) db[userId] = { saldo: 0 };
  db[userId].saldo += jumlah;
  simpanDatabase();
}

// Fungsi untuk mengurangi saldo
function kurangSaldo(userId, jumlah) {
  if (!db[userId]) db[userId] = { saldo: 0 };
  if (db[userId].saldo < jumlah) return false; // Cek saldo cukup atau tidak
  db[userId].saldo -= jumlah;
  simpanDatabase();
  return true; // Berhasil mengurangi saldo
}

// Fungsi untuk menyimpan perubahan ke database.json
function simpanDatabase() {
  fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

// Mengekspor fungsi agar bisa dipakai di file lain 
module.exports = { getSaldo, tambahSaldo, kurangSaldo };
