const mysql = require('mysql2');

// Buat koneksi ke database MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Sesuaikan jika MySQL kamu memiliki password
    database: 'level_bot_whatsapp'
});

// Coba sambungkan ke database
connection.connect(err => {
    if (err) {
        console.error('❌ Gagal terhubung ke database:', err);
        return;
    }
    console.log('✅ Terhubung ke database MySQL');

    // Jalankan query sederhana untuk memastikan koneksi berfungsi
    connection.query('SELECT 1 AS result', (err, results) => {
        if (err) {
            console.error('❌ Query error:', err);
        } else {
            console.log('✅ Hasil query test:', results);
        }
        // Tutup koneksi setelah pengujian
        connection.end();
    });
});
