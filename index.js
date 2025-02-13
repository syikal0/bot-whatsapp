const { makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const { writeFile } = require("fs").promises;
const sharp = require("sharp");
const axios = require("axios");

// Import modul leveling
const { getUser, addUser, updateXP, getLeaderboardByGroup, getUniqueId } = require("./level");

// Import modul virtual money
const { getBalance, deposit, kurangSaldo, normalizePhone } = require("./virtualMoney");

// Atur BOT_OWNER (ganti dengan ID owner yang sesuai)
const BOT_OWNER = "6285189551284@s.whatsapp.net";

// Import modul welcome, suitGame, gamblingGame, shop, inventory
const welcome = require('./welcome');
const playSuitGame = require('./suitGame');
const gamblingGame = require('./gamblingGame');
const shop = require('./shop');
const inventory = require('./inventory');

const pool = require('./db_virtual_money');

// Import modul anti link
const {
    checkLink,
    enableAntiLink,
    disableAntiLink,
    isAntiLinkEnabled,
    addViolation,
    resetViolations
} = require("./antiLink");

// Import modul tag (untuk perintah !h)
const { tagAll, syncGroupMembers } = require("./tag");

// Fungsi helper untuk mengecek apakah user adalah admin grup
async function isGroupAdmin(sock, groupId, userId) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        // Filter partisipan yang memiliki properti admin ("admin" atau "superadmin")
        const adminIds = metadata.participants
            .filter((participant) => participant.admin && (participant.admin === "admin" || participant.admin === "superadmin"))
            .map((participant) => participant.id);
        return adminIds.includes(userId);
    } catch (err) {
        console.error("Error saat mengambil metadata grup:", err);
        return false;
    }
}

async function startBot() {
    console.log("📱 Menghubungkan ke WhatsApp...");

    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        console.log("🔄 Status koneksi:", connection);

        if (connection === "open") {
            console.log("✅ Bot terhubung ke WhatsApp!");
        } else if (connection === "close") {
            console.log("⚠️ Koneksi terputus, mencoba menyambung kembali...");
            startBot();
        }
    });

    // === EVENT LISTENER UNTUK FITUR WELCOME ===
    sock.ev.on("group-participants.update", async (update) => {
        await welcome(sock, update);
    });

    // === UPDATE DATA ANGGOTA GRUP UNTUK FITUR TAG (Menggunakan database db_tag) ===
    // Pastikan file db_tag.js sudah dibuat dan terkonfigurasi
    const poolTag = require("./db_tag");
    sock.ev.on("group-participants.update", async (update) => {
        try {
            const groupId = update.id; // Contoh: "628xxxxxxx@g.us"
            const action = update.action; // "add", "remove", dsb.
            if (action === "add") {
                for (const participant of update.participants) {
                    // Gunakan INSERT IGNORE agar tidak terjadi duplikasi
                    await poolTag.query(
                        "INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)",
                        [groupId, participant]
                    );
                }
            } else if (action === "remove") {
                for (const participant of update.participants) {
                    await poolTag.query(
                        "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
                        [groupId, participant]
                    );
                }
            }
        } catch (err) {
            console.error("Error mengupdate data group_members:", err);
        }
    });

    // Event listener utama untuk pesan
    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages || !m.messages[0].message) return;
        const msg = m.messages[0];

        // Abaikan pesan dari bot sendiri
        if (msg.key.fromMe) return;

        // Tentukan sender, unique ID untuk leveling, dan virtualMoneyId
        let senderId = msg.key.participant ? msg.key.participant : msg.key.remoteJid;
        let uniqueId = senderId;
        if (msg.key.remoteJid.endsWith("@g.us")) {
            uniqueId = `${senderId}_${msg.key.remoteJid}`;
        }
        console.log(`DEBUG: Unique ID untuk leveling: ${uniqueId}`);

        // Gunakan ID individu untuk virtual money
        const virtualMoneyId = msg.key.participant ? msg.key.participant : msg.key.remoteJid;

        // Ambil teks pesan
        const fullMessage = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        if (!fullMessage) return;

        // Auto XP untuk pesan non-command di grup
        if (msg.key.remoteJid.endsWith("@g.us") && !fullMessage.startsWith("!")) {
            const uid = msg.key.participant ? msg.key.participant : msg.key.remoteJid;
            const autoXp = Math.floor(Math.random() * 5) + 1;
            try {
                const success = await updateXP(uid, autoXp);
                if (success) {
                    console.log(`Auto XP: ${uid} mendapatkan ${autoXp} XP secara otomatis.`);
                } else {
                    console.error(`Gagal memperbarui XP untuk ${uid}`);
                }
            } catch (error) {
                console.error(`Error saat memperbarui XP untuk ${uid}:`, error);
            }
        }

        // Pisahkan perintah dan argumen
        const args = fullMessage.split(/\s+/);
        const command = args.shift().toLowerCase();
        console.log(`📩 Pesan masuk dari ${msg.key.remoteJid}: ${fullMessage}`);

        // === PERINTAH-PERINTAH BOT ===

        // !leaderboard
        if (command === "!leaderboard") {
            if (!msg.key.remoteJid.endsWith("@g.us")) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Perintah ini hanya bisa digunakan di grup." });
                return;
            }
            try {
                const leaderboard = await getLeaderboardByGroup(msg.key.remoteJid);
                if (!leaderboard || leaderboard.length === 0) {
                    await sock.sendMessage(msg.key.remoteJid, { text: "⚠️ Belum ada pemain dalam leaderboard grup ini." });
                } else {
                    let message = "🏆 *Leaderboard Grup* 🏆\n\n";
                    leaderboard.forEach((user, index) => {
                        message += `${index + 1}. ${user.nama} - Level ${user.level} (XP: ${user.xp})\n`;
                    });
                    await sock.sendMessage(msg.key.remoteJid, { text: message });
                }
            } catch (err) {
                console.error("Error retrieving leaderboard:", err);
                await sock.sendMessage(msg.key.remoteJid, { text: "Terjadi kesalahan saat mengambil leaderboard." });
            }
        }
        // !level
        else if (command === "!level") {
            console.log("DEBUG: Perintah !level diterima.");
            try {
                const uid = msg.key.participant ? msg.key.participant : msg.key.remoteJid;
                let user = await getUser(uid);
                if (user) {
                    await sock.sendMessage(msg.key.remoteJid, { text: `📊 Level: ${user.level}, XP: ${user.xp}/100` });
                } else {
                    const groupId = msg.key.remoteJid.endsWith("@g.us") ? msg.key.remoteJid : null;
                    await addUser(uid, groupId);
                    user = await getUser(uid);
                    if (user) {
                        await sock.sendMessage(msg.key.remoteJid, { text: `✅ Kamu telah ditambahkan ke database leveling! Level: ${user.level}, XP: ${user.xp}/100` });
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, { text: "✅ Kamu telah ditambahkan ke database leveling!" });
                    }
                }
            } catch (error) {
                console.error("Error saat mengambil data level:", error);
                await sock.sendMessage(msg.key.remoteJid, { text: "Terjadi kesalahan saat mengambil data level." });
            }
        }
        // !stiker
        const isImageMessage = msg.message?.imageMessage ? true : false;
        if (command === "!stiker" && isImageMessage) {
            try {
                console.log("📥 Mengunduh gambar...");
                let buffer = await downloadMediaMessage(msg, "buffer", {});

                if (!buffer || buffer.length === 0) {
                    console.log("❌ Gagal mengunduh gambar!");
                    await sock.sendMessage(msg.key.remoteJid, { text: "❌ Gagal mengunduh gambar!" });
                    return;
                }

                console.log("✅ Gambar berhasil diunduh!");

                const tempDir = path.resolve(__dirname, "temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

                const imagePath = path.join(tempDir, "temp_image.png");
                const stickerPath = path.join(tempDir, "temp_sticker.webp");

                await writeFile(imagePath, buffer);
                console.log("✅ Gambar disimpan sementara:", imagePath);

                await sharp(imagePath)
                    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp({ lossless: true })
                    .toFile(stickerPath);

                console.log("✅ Stiker berhasil dibuat.");

                const sticker = fs.readFileSync(stickerPath);
                await sock.sendMessage(msg.key.remoteJid, { sticker });

                console.log("✅ Stiker berhasil dikirim!");

                fs.unlinkSync(imagePath);
                fs.unlinkSync(stickerPath);
            } catch (error) {
                console.error("❌ Terjadi kesalahan saat mengonversi ke stiker:", error);
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Terjadi kesalahan saat membuat stiker!" });
            }
        } else if (command === "!stiker" && !isImageMessage) {
            await sock.sendMessage(msg.key.remoteJid, { text: "❌ Kirim perintah *!stiker* bersama dengan gambar!" });
        }
        // !menu
        else if (command === "!menu") {
            let menu = "📌 *Menu KBot*\n";
            menu += "1. !help - Melihat bantuan\n";
            menu += "2. !info - Info tentang KBot\n";
            menu += "3. !waktu - Cek waktu sekarang\n";
            menu += "4. !gambar - Kirim gambar dari bot\n";
            menu += "5. !antilink - bot akan memperingati orang yang mengirim link(hanya admin/owner)\n";
            menu += "6. !jodoh - Mencocokkan nama dengan pasangan\n";
            menu += "7. !tebakangka - Mainkan game tebak angka untuk dapat saldo\n";
            menu += "8. !level - Mengetahui level kamu\n";
            menu += "9. !saldo - Mengecek saldo kamu\n";
            menu += "10. !deposit [jumlah] [target] - Deposit saldo ke akun target (hanya admin/owner)\n";
            menu += "11. !suit - Suit games\n";
            menu += "12. !coinflip - Tebak koin flip head/tail\n";
            menu += "13. !shop - Beli item di shop\n";
            menu += "14. !inventory - Lihat item yang sudah dibeli\n";
            menu += "15. !h - untuk tag semua member yang ada di grup\n";

            // Menambahkan 3 baris kosong sebagai pemisah
            menu += "\n\n\n";

            // Menambahkan link donasi di bagian bawah menu
            menu += "Donasi: https://sociabuzz.com/kalllls/donate";

            await sock.sendMessage(msg.key.remoteJid, { text: menu });
        }

        // !info
        else if (command === "!info") {
            await sock.sendMessage(msg.key.remoteJid, { text: "🤖 Ini adalah KBot, bot WhatsApp otomatis!" });
        }
        // !waktu
        else if (command === "!waktu") {
            const waktu = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
            await sock.sendMessage(msg.key.remoteJid, { text: `⏰ Waktu sekarang: ${waktu}` });
        }
        // !saldo
        else if (command === "!saldo") {
            try {
                const balance = await getBalance(virtualMoneyId);
                await sock.sendMessage(msg.key.remoteJid, { text: `💰 Saldo kamu saat ini: ${balance}` });
            } catch (error) {
                console.error("Error pada cek saldo:", error);
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Terjadi kesalahan saat mengecek saldo." });
            }
        }
        // !deposit
        else if (command === "!deposit") {
            if (msg.key.remoteJid.endsWith("@g.us")) {
                const isAdmin = await isGroupAdmin(sock, msg.key.remoteJid, msg.key.participant);
                if (!isAdmin) {
                    await sock.sendMessage(msg.key.remoteJid, { text: "Maaf, hanya admin grup yang dapat menggunakan perintah !deposit." });
                    return;
                }
            } else {
                if (virtualMoneyId !== BOT_OWNER) {
                    await sock.sendMessage(msg.key.remoteJid, { text: "Maaf, hanya owner yang dapat menggunakan perintah !deposit." });
                    return;
                }
            }
            if (args.length < 2) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Format deposit: !deposit [jumlah] [target]" });
                return;
            }
            const amount = parseFloat(args[0]);
            if (isNaN(amount) || amount <= 0) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Jumlah deposit tidak valid." });
                return;
            }
            const target = args[1];
            try {
                const resultMessage = await deposit(target, amount);
                await sock.sendMessage(msg.key.remoteJid, { text: resultMessage });
            } catch (error) {
                console.error("Error pada deposit:", error);
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Terjadi kesalahan saat deposit." });
            }
        }
        // !tebakangka
        else if (command === "!tebakangka") {
            if (args.length < 1) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Format: !tebakangka [angka antara 1-10]" });
                return;
            }
            const guess = parseInt(args[0], 10);
            if (isNaN(guess) || guess < 1 || guess > 10) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Tebakan harus berupa angka antara 1 dan 10." });
                return;
            }
            const correctNumber = Math.floor(Math.random() * 10) + 1;
            if (guess === correctNumber) {
                try {
                    const reward = 100;
                    const resultMessage = await deposit(virtualMoneyId, reward);
                    await sock.sendMessage(msg.key.remoteJid, { text: `Selamat, tebakan kamu benar! Angka yang benar adalah ${correctNumber}. Kamu mendapatkan ${reward} saldo. ${resultMessage}` });
                } catch (error) {
                    console.error("Error saat memberikan reward game:", error);
                    await sock.sendMessage(msg.key.remoteJid, { text: "Terjadi kesalahan saat memberikan hadiah game." });
                }
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: `Tebakan kamu salah. Angka yang benar adalah ${correctNumber}. Coba lagi!` });
            }
        }
        // !jodoh
        else if (command === "!jodoh") {
            if (args.length < 1) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Cara bermain !jodoh:\nKirim perintah: !jodoh <nama pasangan>\nContoh: !jodoh Zainab Farhan" });
                return;
            }
            let partnerName = args.join(" ");
            let compatibility = Math.floor(Math.random() * 101);
            let message = `💖 *Hasil Permainan !jodoh*\n`;
            message += `Kecocokan antara kamu dan *${partnerName}* adalah *${compatibility}%*.\n\n`;
            if (compatibility > 80) {
                message += "🎉 Wow, kalian sangat serasi!";
            } else if (compatibility >= 50) {
                message += "😊 Lumayan, ada potensi.";
            } else {
                message += "😢 Sepertinya kalian kurang cocok.";
            }
            await sock.sendMessage(msg.key.remoteJid, { text: message });
        }
        // !gambar
        else if (command === "!gambar") {
            let imageUrl = "https://picsum.photos/200/300";
            await sock.sendMessage(msg.key.remoteJid, { image: { url: imageUrl }, caption: "Ini adalah gambar acak dari Picsum." });
        }
        // !suit
        if (command === "!suit") {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentioned.length > 0) {
                await playSuitGame.createSuitChallenge(sock, msg.key.remoteJid, mentioned[0]);
            } else {
                if (args.length < 1) {
                    await sock.sendMessage(msg.key.remoteJid, { text: "Format: !suit [pilihan] atau tag pengguna untuk tantangan." });
                    return;
                }
                const choice = args[0].toLowerCase();
                await playSuitGame.playSuitVsBot(sock, msg.key.remoteJid, choice, deposit, virtualMoneyId);
            }
        }
        else if (command === "!acceptsuit") {
            await playSuitGame.acceptSuitChallenge(sock, msg.key.remoteJid);
        }
        else if (command === "!choose") {
            if (args.length < 1) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Format: !choose [gunting|batu|kertas]" });
                return;
            }
            const choice = args[0].toLowerCase();
            await playSuitGame.chooseSuit(sock, msg.key.remoteJid, choice, deposit);
        }
        // !coinflip (gamblingGames)
        else if (command === "!coinflip") {
            await gamblingGame.coinFlipGamble(sock, virtualMoneyId, args, getBalance, deposit, kurangSaldo);
        }
        // !shop
        else if (command === "!shop") {
            const items = shop.getShopItems();
            let shopMessage = "🛒 *Daftar Shop*\n\n";
            items.forEach(item => {
                shopMessage += `ID: ${item.id}\nNama: ${item.name}\nDeskripsi: ${item.description}\nHarga: ${item.price}\n\n`;
            });
            shopMessage += "Gunakan perintah !buy <ID> untuk membeli item.";
            await sock.sendMessage(msg.key.remoteJid, { text: shopMessage });
        }
        // !buy
        else if (command === "!buy") {
            if (args.length < 1) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Format: !buy <ID>" });
                return;
            }
            const itemId = parseInt(args[0], 10);
            const item = shop.getItemById(itemId);
            if (!item) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Item tidak ditemukan." });
                return;
            }
            try {
                const balance = await getBalance(virtualMoneyId);
                if (balance < item.price) {
                    await sock.sendMessage(msg.key.remoteJid, { text: "Saldo tidak mencukupi untuk membeli item ini." });
                    return;
                }
                const purchaseMessage = await kurangSaldo(virtualMoneyId, item.price);
                console.log(`DEBUG: Nomor yang dicari di database: ${virtualMoneyId}`);
                const cleanPhone = normalizePhone(virtualMoneyId);
                console.log(`DEBUG: Nomor setelah normalisasi: ${cleanPhone}`);
                const [userRows] = await pool.query("SELECT id FROM users WHERE phone_number = ?", [cleanPhone]);
                if (userRows.length === 0) {
                    console.error(`ERROR: User dengan nomor ${virtualMoneyId} tidak ditemukan di database.`);
                    throw new Error("User tidak ditemukan");
                }
                const userId = userRows[0].id;
                console.log(`DEBUG: User ditemukan dengan ID ${userId}`);
                await pool.query("INSERT INTO inventory (user_id, item_id) VALUES (?, ?)", [userId, item.id]);
                await sock.sendMessage(msg.key.remoteJid, { text: `Pembelian berhasil! ${item.name} telah dibeli.\n${purchaseMessage}` });
            } catch (error) {
                console.error("Error saat membeli item:", error);
                await sock.sendMessage(msg.key.remoteJid, { text: "Terjadi kesalahan saat memproses pembelian." });
            }
        }
        // !inventory
        else if (command === "!inventory") {
            try {
                console.log(`DEBUG: Mengambil inventori untuk nomor: ${virtualMoneyId}`);
                const cleanPhone = virtualMoneyId.replace(/[^0-9]/g, "");
                console.log(`DEBUG: Nomor setelah normalisasi: ${cleanPhone}`);
                const items = await inventory.getInventory(cleanPhone);
                console.log(`DEBUG: Items yang ditemukan:`, items);
                if (items.length === 0) {
                    await sock.sendMessage(msg.key.remoteJid, { text: "Kamu belum memiliki item di inventori." });
                    return;
                }
                let inventoryMessage = "🗃 *Inventori Kamu:*\n\n";
                items.forEach((item, index) => {
                    inventoryMessage += `${index + 1}. ID: ${item.inventory_id}\n`;
                    inventoryMessage += `Nama: ${item.name}\nDeskripsi: ${item.description}\nStatus: ${item.used ? "Digunakan" : "Belum digunakan"}\n\n`;
                });
                inventoryMessage += "Gunakan perintah !use <ID> untuk menggunakan item yang diinginkan.";
                await sock.sendMessage(msg.key.remoteJid, { text: inventoryMessage });
            } catch (error) {
                console.error("Error mengambil inventori:", error);
                await sock.sendMessage(msg.key.remoteJid, { text: "Terjadi kesalahan saat mengambil inventori." });
            }
        }
        // !use
        else if (command === "!use") {
            if (args.length < 1) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Format: !use <ID>" });
                return;
            }
            const inventoryId = parseInt(args[0], 10);
            if (isNaN(inventoryId)) {
                await sock.sendMessage(msg.key.remoteJid, { text: "ID item tidak valid." });
                return;
            }
            try {
                const useResult = await inventory.useItem(virtualMoneyId, inventoryId);
                await sock.sendMessage(msg.key.remoteJid, { text: useResult });
            } catch (error) {
                console.error("Error saat menggunakan item:", error);
                await sock.sendMessage(msg.key.remoteJid, { text: `Gagal menggunakan item: ${error.message}` });
            }
        }
        // Perintah anti link: !antilinkon dan !antilinkoff (hanya admin/owner)
        else if (command === "!antilinkon") {
            if (!msg.key.remoteJid.endsWith("@g.us")) return;
            const isAdmin = await isGroupAdmin(sock, msg.key.remoteJid, msg.key.participant);
            if (isAdmin || virtualMoneyId === BOT_OWNER) {
                const result = await enableAntiLink(msg.key.remoteJid);
                await sock.sendMessage(msg.key.remoteJid, { text: result });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Hanya admin yang dapat mengaktifkan fitur ini!" });
            }
        }
        else if (command === "!antilinkoff") {
            if (!msg.key.remoteJid.endsWith("@g.us")) return;
            const isAdmin = await isGroupAdmin(sock, msg.key.remoteJid, msg.key.participant);
            if (isAdmin || virtualMoneyId === BOT_OWNER) {
                const result = await disableAntiLink(msg.key.remoteJid);
                await sock.sendMessage(msg.key.remoteJid, { text: result });
            } else {
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Hanya admin yang dapat menonaktifkan fitur ini!" });
            }
        }

        // Handler untuk setiap pesan grup, lakukan pengecekan link (Anti Link)
        sock.ev.on("messages.upsert", async (m) => {
            const msg = m.messages[0];
            if (!msg.message) return;
            const groupId = msg.key.remoteJid;
            if (!groupId.endsWith("@g.us")) return;
            if (await isAntiLinkEnabled(groupId)) {
                if (checkLink(msg)) {
                    const sender = msg.key.participant || msg.key.remoteJid;
                    console.log(`Anti Link: Terdeteksi link dari ${sender} di grup ${groupId}`);
                    const shouldKick = await addViolation(groupId, sender);
                    await sock.sendMessage(
                        groupId,
                        {
                            text: `⚠️ @${sender.split("@")[0]}, jangan kirim link! (Pelanggaran: ${shouldKick ? "3 - kamu akan dikeluarkan" : "1 atau 2"})`
                        },
                        { quoted: msg, mentions: [sender] }
                    );
                    if (shouldKick) {
                        await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                        await sock.sendMessage(
                            groupId,
                            { text: `@${sender.split("@")[0]} telah dikeluarkan karena melanggar aturan anti link.` },
                            { mentions: [sender] }
                        );
                        await resetViolations(groupId, sender);
                    }
                }
            }
        });

        //fitur !sync untuk singkronisasi
        if (command === "!sync") {
            // Pastikan perintah hanya dapat digunakan di grup
            if (!msg.key.remoteJid.endsWith("@g.us")) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Perintah !sync hanya dapat digunakan di grup." });
                return;
            }
            // Cek apakah pengirim adalah admin atau owner
            const isAdmin = await isGroupAdmin(sock, msg.key.remoteJid, msg.key.participant);
            if (!isAdmin && virtualMoneyId !== BOT_OWNER) {
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Hanya admin atau owner yang dapat menggunakan perintah !sync." });
                return;
            }
            // Sinkronisasi anggota grup
            await syncGroupMembers(sock, msg.key.remoteJid);
            await sock.sendMessage(msg.key.remoteJid, { text: "Sinkronisasi anggota grup berhasil." });
        }


        // Handler untuk perintah !h (Tag All)
        if (command === "!h") {
            // Perintah hanya dapat digunakan di grup
            if (!msg.key.remoteJid.endsWith("@g.us")) {
                await sock.sendMessage(msg.key.remoteJid, { text: "Perintah !h hanya dapat digunakan di grup." });
                return;
            }
            const isAdmin = await isGroupAdmin(sock, msg.key.remoteJid, msg.key.participant);
            if (!isAdmin && virtualMoneyId !== BOT_OWNER) {
                await sock.sendMessage(msg.key.remoteJid, { text: "❌ Hanya admin atau owner yang dapat menggunakan perintah !h." });
                return;
            }
            await tagAll(sock, msg.key.remoteJid);
        }

    }); // Akhir event listener messages.upsert
}

startBot();
