// antiLink.js
const pool = require('./db_antilink'); // Gunakan koneksi dari database anti link baru

/**
 * Mengecek apakah pesan mengandung link menggunakan regex.
 */
function checkLink(message) {
  const linkRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}([^\s]*)/gi;
  let text = "";
  if (message.conversation) {
    text = message.conversation;
  } else if (message.extendedTextMessage && message.extendedTextMessage.text) {
    text = message.extendedTextMessage.text;
  }
  if (!text) return false;
  return linkRegex.test(text);
}

/**
 * Mengecek apakah fitur Anti Link aktif di sebuah grup.
 */
async function isAntiLinkEnabled(groupId) {
  const [rows] = await pool.query(
    "SELECT anti_link_enabled FROM group_settings WHERE group_id = ?",
    [groupId]
  );
  if (rows.length > 0) {
    return rows[0].anti_link_enabled == 1;
  } else {
    return false;
  }
}

/**
 * Mengaktifkan fitur Anti Link di grup.
 */
async function enableAntiLink(groupId) {
  const [rows] = await pool.query(
    "SELECT group_id FROM group_settings WHERE group_id = ?",
    [groupId]
  );
  if (rows.length > 0) {
    await pool.query(
      "UPDATE group_settings SET anti_link_enabled = 1 WHERE group_id = ?",
      [groupId]
    );
  } else {
    await pool.query(
      "INSERT INTO group_settings (group_id, anti_link_enabled) VALUES (?, 1)",
      [groupId]
    );
  }
  return "✅ Fitur Anti Link telah AKTIF di grup ini!";
}

/**
 * Menonaktifkan fitur Anti Link di grup.
 */
async function disableAntiLink(groupId) {
  const [rows] = await pool.query(
    "SELECT group_id FROM group_settings WHERE group_id = ?",
    [groupId]
  );
  if (rows.length > 0) {
    await pool.query(
      "UPDATE group_settings SET anti_link_enabled = 0 WHERE group_id = ?",
      [groupId]
    );
  } else {
    await pool.query(
      "INSERT INTO group_settings (group_id, anti_link_enabled) VALUES (?, 0)",
      [groupId]
    );
  }
  return "❌ Fitur Anti Link telah NONAKTIF di grup ini.";
}

/**
 * Menambahkan pelanggaran untuk pengguna di grup.
 * Mengembalikan true jika jumlah pelanggaran mencapai 3.
 */
async function addViolation(groupId, userId) {
  const [rows] = await pool.query(
    "SELECT violation_count FROM group_violations WHERE group_id = ? AND user_id = ?",
    [groupId, userId]
  );
  let count = 0;
  if (rows.length > 0) {
    count = rows[0].violation_count + 1;
    await pool.query(
      "UPDATE group_violations SET violation_count = ? WHERE group_id = ? AND user_id = ?",
      [count, groupId, userId]
    );
  } else {
    count = 1;
    await pool.query(
      "INSERT INTO group_violations (group_id, user_id, violation_count) VALUES (?, ?, ?)",
      [groupId, userId, count]
    );
  }
  return count >= 3;
}

/**
 * Mereset pelanggaran untuk pengguna di grup.
 */
async function resetViolations(groupId, userId) {
  await pool.query(
    "DELETE FROM group_violations WHERE group_id = ? AND user_id = ?",
    [groupId, userId]
  );
}

module.exports = { 
  checkLink, 
  enableAntiLink, 
  disableAntiLink, 
  isAntiLinkEnabled, 
  addViolation, 
  resetViolations 
};
