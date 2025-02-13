// tag.js
const poolTag = require("./db_tag"); // Koneksi database untuk fitur tag

/**
 * Fungsi untuk men-tag semua anggota grup.
 * @param {object} sock - Instance koneksi WhatsApp (misalnya, dari Baileys)
 * @param {string} groupId - ID grup (misalnya, "628123456789@g.us")
 */
async function tagAll(sock, groupId) {
    try {
        // Ambil data anggota grup dari tabel group_members di database db_tag
        const [members] = await poolTag.query(
            "SELECT user_id FROM group_members WHERE group_id = ?",
            [groupId]
        );
        if (members.length === 0) {
            await sock.sendMessage(groupId, { text: "Tidak ada anggota yang terdaftar di database." });
            return;
        }

        // Susun pesan tag
        let tagMessage = "📣 Tag All:\n";
        const mentions = [];
        members.forEach(member => {
            // Ubah user_id dari format "628xxxxxxx@s.whatsapp.net" menjadi "628xxxxxxx"
            const userTag = member.user_id.split("@")[0];
            tagMessage += `@${userTag} `;
            mentions.push(member.user_id);
        });

        // Kirim pesan ke grup dengan mention
        await sock.sendMessage(groupId, { text: tagMessage, mentions });
    } catch (error) {
        console.error("Error saat melakukan tag all:", error);
        await sock.sendMessage(groupId, { text: "Terjadi kesalahan saat melakukan tag all." });
    }
}

async function syncGroupMembers(sock, groupId) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        for (const participant of metadata.participants) {
            // Gunakan INSERT IGNORE agar jika data sudah ada tidak terjadi duplikasi.
            await poolTag.query(
                "INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)",
                [groupId, participant.id]
            );
        }
        console.log(`Sync anggota grup ${groupId} berhasil.`);
    } catch (error) {
        console.error("Error saat sinkronisasi anggota grup:", error);
    }
}

module.exports = { tagAll, syncGroupMembers };
