const { makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const { writeFile } = require("fs").promises;
const sharp = require("sharp");
const axios = require("axios");

// Import sistem saldo dari database.js
const { getSaldo, tambahSaldo, kurangSaldo } = require("./database");

// Import sistem leveling dari level.js
const { addXP, getUserLevel, getXpForNextLevel } = require("./level");

const OWNER_ID = '6285189551284@s.whatsapp.net'; // Nomor bot sebagai OWNER_ID

async function startBot() {
    console.log("\ud83d\udcf1 Menghubungkan ke WhatsApp...");

    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection } = update;
        console.log("\ud83d\udd04 Status koneksi:", connection);

        if (connection === "open") {
            console.log("✅ Bot terhubung ke WhatsApp!");
        } else if (connection === "close") {
            console.log("⚠️ Koneksi terputus, mencoba menyambung kembali...");
            startBot();
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages || !m.messages[0].message) return;

        const msg = m.messages[0];
        const sender = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        console.log(`📩 Pesan masuk dari ${sender}: ${textMessage}`);

        if (textMessage.toLowerCase().startsWith("!tambahsaldo ")) {
            const args = textMessage.split(" ");
            let targetUserId = args[1];
            const jumlah = parseInt(args[2]);

            if (sender !== OWNER_ID) {
                await sock.sendMessage(sender, { text: "❌ Hanya owner yang dapat menggunakan perintah ini!" });
                return;
            }

            if (sender.endsWith('@g.us')) {
                const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
                if (mentionedJid && mentionedJid.length > 0) {
                    targetUserId = mentionedJid[0];
                } else {
                    await sock.sendMessage(sender, { text: "❌ Tidak ada pengguna yang disebut dalam grup!" });
                    return;
                }
            }

            if (!targetUserId.endsWith("@s.whatsapp.net")) {
                targetUserId += "@s.whatsapp.net";
            }

            if (!targetUserId || isNaN(jumlah) || jumlah <= 0) {
                await sock.sendMessage(sender, { text: "❌ Format salah! Gunakan *!tambahsaldo @user 1000*" });
                return;
            }

            tambahSaldo(targetUserId, jumlah);
            await sock.sendMessage(sender, { text: `✅ Saldo pengguna ${targetUserId} bertambah ${jumlah}!` });
        }

        if (textMessage.toLowerCase() === "!saldo") {
            let saldoUser = getSaldo(sender);
            await sock.sendMessage(sender, { text: `💰 Saldo kamu saat ini: ${saldoUser}` });
        }
    });
}

startBot();