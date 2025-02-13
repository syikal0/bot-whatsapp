// suitGame.js

// Objek untuk menyimpan tantangan suit yang aktif
const activeSuitChallenges = {};

/**
 * Mengirimkan tantangan suit dari challenger kepada challenged.
 * @param {Object} sock - Instance socket WhatsApp.
 * @param {string} challenger - ID pengirim (yang mengirim perintah).
 * @param {string} challenged - ID pengguna yang di-tag untuk ditantang.
 */
async function createSuitChallenge(sock, challenger, challenged) {
  const challengeKey = `${challenger}_${challenged}`;
  if (activeSuitChallenges[challengeKey]) {
    await sock.sendMessage(challenger, { text: "Tantangan suit sudah ada dengan pengguna tersebut." });
    return;
  }

  activeSuitChallenges[challengeKey] = {
    challenger,
    challenged,
    challengerChoice: null,
    challengedChoice: null,
    timestamp: Date.now(),
  };

  await sock.sendMessage(challenger, { text: `Tantangan suit telah dikirim ke ${challenged}. Menunggu konfirmasi...` });
  await sock.sendMessage(challenged, { text: `Anda ditantang suit oleh ${challenger}. Ketik !acceptsuit untuk menerima tantangan.` });
}

/**
 * Menerima tantangan suit yang ditujukan untuk user.
 * @param {Object} sock - Instance socket WhatsApp.
 * @param {string} challenged - ID pengguna yang menerima tantangan.
 */
async function acceptSuitChallenge(sock, challenged) {
  let challengeKey;
  for (const key in activeSuitChallenges) {
    if (activeSuitChallenges[key].challenged === challenged) {
      challengeKey = key;
      break;
    }
  }

  if (!challengeKey) {
    await sock.sendMessage(challenged, { text: "Tidak ada tantangan suit yang tersedia untuk Anda." });
    return;
  }

  await sock.sendMessage(challenged, { text: "Tantangan diterima! Silakan pilih: !choose [gunting|batu|kertas]" });
  await sock.sendMessage(activeSuitChallenges[challengeKey].challenger, { text: `${challenged} telah menerima tantangan. Silakan pilih: !choose [gunting|batu|kertas]` });
}

/**
 * Mencatat pilihan pemain untuk tantangan suit yang aktif dan menyelesaikan permainan bila kedua pilihan sudah ada.
 * Jika ada pemenang (tidak seri), maka pemenang akan mendapatkan saldo (misalnya 50 unit).
 * @param {Object} sock - Instance socket WhatsApp.
 * @param {string} user - ID pengguna yang mengirim pilihan.
 * @param {string} choice - Pilihan yang dikirim ("gunting", "batu", atau "kertas").
 * @param {Function} deposit - Fungsi deposit untuk menambahkan saldo.
 */
async function chooseSuit(sock, user, choice, deposit) {
  const validChoices = ["gunting", "batu", "kertas"];
  if (!validChoices.includes(choice)) {
    await sock.sendMessage(user, { text: "Pilihan tidak valid. Gunakan: gunting, batu, atau kertas." });
    return;
  }

  let challengeKey;
  for (const key in activeSuitChallenges) {
    const challenge = activeSuitChallenges[key];
    if (challenge.challenger === user || challenge.challenged === user) {
      challengeKey = key;
      break;
    }
  }
  
  if (!challengeKey) {
    await sock.sendMessage(user, { text: "Tidak ada tantangan suit yang aktif untuk Anda." });
    return;
  }
  
  const challenge = activeSuitChallenges[challengeKey];
  if (challenge.challenger === user && !challenge.challengerChoice) {
    challenge.challengerChoice = choice;
    await sock.sendMessage(user, { text: `Pilihan Anda (${choice}) telah disimpan. Menunggu pilihan lawan...` });
  } else if (challenge.challenged === user && !challenge.challengedChoice) {
    challenge.challengedChoice = choice;
    await sock.sendMessage(user, { text: `Pilihan Anda (${choice}) telah disimpan. Menunggu pilihan lawan...` });
  } else {
    await sock.sendMessage(user, { text: "Anda sudah memilih." });
    return;
  }
  
  // Jika kedua pemain sudah memilih, selesaikan permainan
  if (challenge.challengerChoice && challenge.challengedChoice) {
    const result = resolveSuit(challenge.challengerChoice, challenge.challengedChoice);
    let resultText = `Hasil suit:\n${challenge.challenger} memilih: ${challenge.challengerChoice}\n${challenge.challenged} memilih: ${challenge.challengedChoice}\n`;
    let rewardText = "";
    if (result === "seri") {
      resultText += "Hasil: Seri!";
    } else {
      let winner;
      if (result === "challenger") {
        winner = challenge.challenger;
      } else {
        winner = challenge.challenged;
      }
      resultText += `Pemenang: ${winner}`;
      // Berikan hadiah saldo ke pemenang
      const reward = 50;
      try {
        const depositResult = await deposit(winner, reward);
        rewardText = `\nKamu mendapatkan ${reward} saldo.\n${depositResult}`;
      } catch (error) {
        console.error("Error saat memberikan hadiah suit:", error);
        rewardText = "\nTerjadi kesalahan saat memberikan hadiah.";
      }
    }
    const finalText = resultText + rewardText;
    await sock.sendMessage(challenge.challenger, { text: finalText });
    await sock.sendMessage(challenge.challenged, { text: finalText });
    delete activeSuitChallenges[challengeKey];
  }
}

/**
 * Menghitung hasil permainan suit.
 * @param {string} choice1 - Pilihan pemain 1.
 * @param {string} choice2 - Pilihan pemain 2.
 * @returns {string} "seri", "challenger", atau "challenged"
 */
function resolveSuit(choice1, choice2) {
  if (choice1 === choice2) return "seri";
  if (
    (choice1 === "gunting" && choice2 === "kertas") ||
    (choice1 === "batu" && choice2 === "gunting") ||
    (choice1 === "kertas" && choice2 === "batu")
  ) {
    return "challenger";
  }
  return "challenged";
}

/**
 * Mode bermain suit melawan bot. Jika pemain menang, maka akan mendapatkan saldo.
 * @param {Object} sock - Instance socket WhatsApp.
 * @param {string} sender - ID pengirim.
 * @param {string} choice - Pilihan pemain.
 * @param {Function} deposit - Fungsi deposit untuk menambahkan saldo.
 * @param {string} virtualMoneyId - ID pengguna untuk uang virtual.
 */
async function playSuitVsBot(sock, sender, choice, deposit, virtualMoneyId) {
  const validChoices = ["gunting", "batu", "kertas"];
  if (!validChoices.includes(choice)) {
    await sock.sendMessage(sender, { text: "Pilihan tidak valid. Gunakan: gunting, batu, atau kertas." });
    return;
  }
  const botChoice = validChoices[Math.floor(Math.random() * validChoices.length)];
  let resultText = `Kamu memilih *${choice}*\nBot memilih *${botChoice}*\n`;
  let win = false;
  if (choice === botChoice) {
    resultText += "Hasil: Seri!";
  } else if (
    (choice === "gunting" && botChoice === "kertas") ||
    (choice === "batu" && botChoice === "gunting") ||
    (choice === "kertas" && botChoice === "batu")
  ) {
    resultText += "Selamat, kamu menang!";
    win = true;
  } else {
    resultText += "Kamu kalah!";
  }
  if (win) {
    const reward = 50; // misalnya 50 unit uang virtual
    try {
      const resultMessage = await deposit(virtualMoneyId, reward);
      resultText += `\nKamu mendapatkan ${reward} saldo.\n${resultMessage}`;
    } catch (error) {
      console.error("Error saat memberikan hadiah suit:", error);
      resultText += "\nTerjadi kesalahan saat memberikan hadiah.";
    }
  }
  await sock.sendMessage(sender, { text: resultText });
}

module.exports = {
  createSuitChallenge,
  acceptSuitChallenge,
  chooseSuit,
  playSuitVsBot,
};
