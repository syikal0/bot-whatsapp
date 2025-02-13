// level.js
const pool = require('./db_level');  // Pastikan koneksi ini mengarah ke database level_bot_whatsapp

/**
 * Fungsi helper untuk menghasilkan identifier unik dari objek pesan.
 * Jika pesan berasal dari grup, gunakan msg.key.participant; 
 * jika tidak, gunakan msg.key.remoteJid.
 *
 * @param {Object} msg - Objek pesan dari Baileys.
 * @returns {string} Identifier unik (nomor telepon pengguna).
 */
function getUniqueId(msg) {
    return msg.key.participant ? msg.key.participant : msg.key.remoteJid;
}

/**
 * Mengambil data user berdasarkan phone_number.
 *
 * @param {string} phone - Identifier unik pengguna (misalnya: "628123456789@s.whatsapp.net")
 * @returns {Promise<Object>} - Objek user dari tabel users (atau undefined jika tidak ditemukan)
 */
async function getUser(phone) {
    const [rows] = await pool.query("SELECT * FROM users WHERE phone_number = ?", [phone]);
    return rows[0];
}

/**
 * Menambahkan user baru ke tabel users.
 * Nilai default untuk kolom nama diambil dari parameter phone.
 * Jika terjadi duplicate entry (user sudah ada), fungsi akan mengembalikan true.
 *
 * @param {string} phone - Identifier unik pengguna (phone_number)
 * @param {string|null} groupId - ID grup (jika pesan berasal dari grup) atau null jika chat pribadi.
 * @returns {Promise<boolean>}
 */
async function addUser(phone, groupId) {
    try {
        const defaultName = phone; // Gunakan phone sebagai nilai default untuk kolom nama
        await pool.query(
            "INSERT INTO users (phone_number, group_id, xp, level, nama) VALUES (?, ?, 0, 1, ?)",
            [phone, groupId, defaultName]
        );
        return true;
    } catch (err) {
        // Jika terjadi duplicate entry, anggap user sudah ada
        if (err.code === 'ER_DUP_ENTRY') {
            console.log("User sudah ada, mengabaikan duplicate");
            return true;
        }
        console.error("Error addUser:", err);
        throw err;
    }
}

/**
 * Memperbarui XP dan level user berdasarkan phone_number.
 * Misalnya, tiap level naik setiap 100 XP.
 *
 * @param {string} phone - Identifier unik pengguna (phone_number)
 * @param {number} xpAmount - XP tambahan yang akan diberikan
 * @returns {Promise<boolean>}
 */
async function updateXP(phone, xpAmount) {
    try {
        const [rows] = await pool.query("SELECT xp, level FROM users WHERE phone_number = ?", [phone]);
        if (rows.length === 0) return false;
        let currentXP = rows[0].xp || 0;
        let currentLevel = rows[0].level || 1;
        const xpNeededPerLevel = 100;
        let newXP = currentXP + xpAmount;
        let newLevel = currentLevel;
        while (newXP >= xpNeededPerLevel) {
            newXP -= xpNeededPerLevel;
            newLevel += 1;
        }
        await pool.query("UPDATE users SET xp = ?, level = ? WHERE phone_number = ?", [newXP, newLevel, phone]);
        console.log(`XP user ${phone} diperbarui: Level ${newLevel}, XP ${newXP}`);
        return true;
    } catch (error) {
        console.error("Error pada updateXP:", error);
        return false;
    }
}

/**
 * Mengambil leaderboard berdasarkan group_id.
 *
 * @param {string} groupId - ID grup
 * @returns {Promise<Array>} - Daftar user yang diurutkan berdasarkan xp secara menurun
 */
async function getLeaderboardByGroup(groupId) {
    const [rows] = await pool.query("SELECT * FROM users WHERE group_id = ? ORDER BY xp DESC", [groupId]);
    return rows;
}

module.exports = { getUser, addUser, updateXP, getLeaderboardByGroup, getUniqueId };
