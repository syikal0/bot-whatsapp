// inventory.js
const pool = require('./db_virtual_money');
const { deposit } = require('./virtualMoney');
const { updateXP } = require('./level');

/**
 * Mengambil daftar item yang ada di inventori pengguna.
 */
async function getInventory(phone) {
  try {
    const cleanPhone = phone.replace(/\D/g, "");
    const [userRows] = await pool.query("SELECT id FROM users WHERE phone_number = ?", [cleanPhone]);
    if (userRows.length === 0) return [];
    const userId = userRows[0].id;
    const [rows] = await pool.query(
      `SELECT i.id AS inventory_id, i.item_id, i.used, s.name, s.description, s.price, s.reward_type, s.reward_value, s.reward_description
       FROM inventory i
       JOIN shop_items s ON i.item_id = s.id
       WHERE i.user_id = ?`,
      [userId]
    );
    return rows;
  } catch (error) {
    console.error("Error di getInventory:", error);
    throw error;
  }
}

/**
 * Menggunakan item dari inventori.
 */
async function useItem(phone, inventoryId) {
  try {
    // Normalisasi nomor telepon
    const cleanPhone = phone.replace(/\D/g, "");
    console.log(`DEBUG: Mencari user dengan nomor: ${cleanPhone}`);

    // Cek apakah user ada di database
    const [userRows] = await pool.query("SELECT id FROM users WHERE phone_number = ?", [cleanPhone]);
    if (userRows.length === 0) throw new Error("User tidak ditemukan");
    const userId = userRows[0].id;

    // Ambil item dari inventory
    const [rows] = await pool.query(
      `SELECT i.*, s.name, s.reward_type, s.reward_value, s.reward_description 
       FROM inventory i 
       JOIN shop_items s ON i.item_id = s.id 
       WHERE i.id = ? AND i.user_id = ?`,
      [inventoryId, userId]
    );

    if (rows.length === 0) throw new Error("Item tidak ditemukan di inventori");
    const itemRecord = rows[0];

    // Jika item sudah digunakan
    if (itemRecord.used) {
      throw new Error("Item sudah digunakan sebelumnya");
    }

    // Tandai item sebagai digunakan
    await pool.query("UPDATE inventory SET used = 1 WHERE id = ? AND user_id = ?", [inventoryId, userId]);

    // Feedback awal
    let feedbackMessage = `Item "${itemRecord.name}" berhasil digunakan. `;

    //reward untuk lottery ticket
    if (itemRecord.name.toLowerCase() === "lottery ticket") {
      // Pilihan saldo acak saat menggunakan Lottery Ticket
      const possibleRewards = [1, 5, 10, 15, 20 ,50, 70, 100, 150, 200, 250, 300];
      const randomReward = possibleRewards[Math.floor(Math.random() * possibleRewards.length)];

      // Tambahkan saldo ke akun pengguna
      const depositResult = await deposit(phone, randomReward);

      feedbackMessage += `🎟️ Kamu telah menggunakan Lottery Ticket! 🎉 Selamat, kamu mendapatkan saldo sebesar ${randomReward}. ${depositResult}`;
    }

    // Proses reward jika item memiliki reward
    if (itemRecord.name.toLowerCase() === "mystery box") {
      const possibleRewards = [
        { type: "money", amount: 100, message: "Bonus saldo 100" },
        { type: "money", amount: 200, message: "Bonus saldo 200" },
        { type: "xp", amount: 50, message: "Bonus XP 50" },
        { type: "xp", amount: 100, message: "Bonus XP 100" },
        { type: "item", message: "Bonus item rahasia" },
        { type: "vip", message: "VIP Membership selama 24 jam" }
      ];
      const randomReward = possibleRewards[Math.floor(Math.random() * possibleRewards.length)];

      switch (randomReward.type) {
        case "money": {
          const depositResult = await deposit(cleanPhone, randomReward.amount);
          feedbackMessage += `Mystery Box dibuka! ${randomReward.message}. ${depositResult}`;
          break;
        }
        case "xp": {
          const xpBonus = randomReward.amount;
          updateXP(`${userId}`, xpBonus, (success) => {
            if (success) console.log(`Bonus XP ${xpBonus} diberikan ke user ${userId}`);
          });
          feedbackMessage += `Mystery Box dibuka! ${randomReward.message}.`;
          break;
        }
        case "item":
        case "vip": {
          feedbackMessage += `Mystery Box dibuka! ${randomReward.message}.`;
          break;
        }
        default:
          feedbackMessage += "Item tidak memiliki reward khusus.";
          break;
      }
    } else if (itemRecord.reward_type) {
      switch (itemRecord.reward_type.toLowerCase()) {
        case "money": {
          const bonus = itemRecord.reward_value;
          const depositResult = await deposit(cleanPhone, bonus);
          feedbackMessage += `Kamu mendapatkan bonus saldo sebesar ${bonus}. ${depositResult}`;
          break;
        }
        case "xp": {
          const xpBonus = itemRecord.reward_value;
          const additionalXp = Math.floor(xpBonus * 0.5);
          const totalXp = xpBonus + additionalXp;
          updateXP(`${userId}`, totalXp, (success) => {
            if (success) console.log(`Bonus XP ${totalXp} diberikan ke user ${userId}`);
          });
          feedbackMessage += `Kamu mendapatkan bonus XP sebesar ${totalXp} (XP dasar: ${xpBonus} + tambahan: ${additionalXp}).`;
          break;
        }
        case "item":
          feedbackMessage += "Kamu mendapatkan bonus item rahasia!";
          break;
        case "vip":
          feedbackMessage += "VIP Membership kamu telah diaktifkan selama 24 jam!";
          break;
        case "avatar":
          feedbackMessage += "Avatar Frame kamu telah diaktifkan!";
          break;
        default:
          feedbackMessage += "Item tidak memiliki reward khusus.";
          break;
      }
    } else {
      feedbackMessage += "Item tidak memiliki reward khusus.";
    }

    return feedbackMessage;
  } catch (error) {
    console.error("Error di useItem:", error);
    throw error;
  }
}

module.exports = { getInventory, useItem };
