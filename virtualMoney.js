// virtualMoney.js
const pool = require('./db_virtual_money');  // Gunakan koneksi ke database db_virtual_money

// 1. Definisikan fungsi normalizePhone terlebih dahulu
function normalizePhone(phone) {
  // Hapus karakter '@' di awal, jika ada.
  if (phone.startsWith('@')) {
    phone = phone.substring(1);
  }
  // Jika nomor mengandung '@', ambil bagian sebelum '@'
  if (phone.includes('@')) {
    phone = phone.split('@')[0];
  }
  // Jika nomor diawali dengan '0', ubah menjadi format internasional (misalnya, ubah '0' menjadi '62')
  if (phone.startsWith('0')) {
    phone = '62' + phone.substring(1);
  }
  return phone;
}

// 2. Definisikan fungsi ensureUserExists
async function ensureUserExists(phone) {
  phone = normalizePhone(phone); // Normalisasi nomor telepon
  const [rows] = await pool.query('SELECT * FROM users WHERE phone_number = ?', [phone]);
  if (rows.length === 0) {
    await pool.query('INSERT INTO users (phone_number, virtual_money) VALUES (?, 0)', [phone]);
    const [newRows] = await pool.query('SELECT * FROM users WHERE phone_number = ?', [phone]);
    return newRows[0];
  }
  return rows[0];
}

async function getUserByPhone(phone) {
  phone = normalizePhone(phone);
  const [rows] = await pool.query('SELECT * FROM users WHERE phone_number = ?', [phone]);
  return rows.length > 0 ? rows[0] : null;
}


// 3. Tambahkan fungsi getBalance (sebelumnya belum didefinisikan)
async function getBalance(phone) {
  phone = normalizePhone(phone);
  const [rows] = await pool.query('SELECT virtual_money FROM users WHERE phone_number = ?', [phone]);
  if (rows.length === 0) return 0;
  return rows[0].virtual_money;
}

// 4. Fungsi deposit
async function deposit(phone, amount) {
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Jumlah deposit tidak valid');
  }
  phone = normalizePhone(phone);
  console.log('Deposit dijalankan untuk:', phone, 'dengan jumlah:', amount);

  const user = await ensureUserExists(phone);
  console.log('Data user:', user);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [updateResult] = await conn.query(
      'UPDATE users SET virtual_money = virtual_money + ? WHERE id = ?',
      [amount, user.id]
    );
    console.log('Hasil update:', updateResult);

    await conn.query(
      'INSERT INTO transactions (user_id, transaction_type, amount, description) VALUES (?, "deposit", ?, ?)',
      [user.id, amount, 'Deposit via bot WhatsApp']
    );
    await conn.commit();
    return `Deposit sebesar ${amount} berhasil.`;
  } catch (err) {
    await conn.rollback();
    console.error('Error pada deposit:', err);
    throw err;
  } finally {
    conn.release();
  }
}

// 5. Fungsi kurangSaldo
async function kurangSaldo(phone, amount) {
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Jumlah pengurangan tidak valid');
  }
  const user = await ensureUserExists(phone);
  if (user.virtual_money < amount) {
    throw new Error('Saldo tidak mencukupi');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE users SET virtual_money = virtual_money - ? WHERE id = ?', [amount, user.id]);
    await conn.query(
      'INSERT INTO transactions (user_id, transaction_type, amount, description) VALUES (?, "withdraw", ?, ?)',
      [user.id, amount, 'Pengurangan saldo via bot WhatsApp']
    );
    await conn.commit();
    return `Saldo baru: ${user.virtual_money - amount}`;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { ensureUserExists, getBalance, deposit, kurangSaldo, normalizePhone };
