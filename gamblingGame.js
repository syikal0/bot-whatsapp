// gamblingGame.js

async function coinFlipGamble(sock, userId, args, getBalance, deposit, kurangSaldo) {
    if (args.length < 2) {
      await sock.sendMessage(userId, { text: "Format: !coinflip [taruhan] [head/tail]" });
      return;
    }
    
    const bet = parseFloat(args[0]);
    if (isNaN(bet) || bet <= 0) {
      await sock.sendMessage(userId, { text: "Jumlah taruhan tidak valid." });
      return;
    }
    
    const choice = args[1].toLowerCase();
    if (choice !== "head" && choice !== "tail") {
      await sock.sendMessage(userId, { text: "Pilihan tidak valid. Gunakan 'head' atau 'tail'." });
      return;
    }
    
    // Ambil saldo menggunakan userId (bukan sender jika di grup)
    let balance;
    try {
      balance = await getBalance(userId);
    } catch (error) {
      console.error("Error mendapatkan saldo:", error);
      await sock.sendMessage(userId, { text: "Terjadi kesalahan saat mengambil saldo." });
      return;
    }
    
    if (balance < bet) {
      await sock.sendMessage(userId, { text: "Saldo tidak mencukupi untuk taruhan tersebut." });
      return;
    }
    
    // Lakukan coin flip
    const outcomes = ["head", "tail"];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    let message = `Koin dilempar...\nHasil: ${result}\n`;
    
    if (result === choice) {
      // Jika menang, misalnya pemain mendapatkan reward setara dengan taruhan.
      const reward = bet; // Pemain mendapat tambahan saldo sebesar taruhan
      try {
        const depositResult = await deposit(userId, reward);
        message += `Selamat, kamu menang!\nKamu mendapatkan ${reward} saldo tambahan.\n${depositResult}`;
      } catch (error) {
        console.error("Error saat memberikan hadiah coinflip:", error);
        message += "\nTapi terjadi kesalahan saat memberikan hadiah.";
      }
    } else {
      // Jika kalah, kurangi saldo taruhan
      try {
        const kurangResult = await kurangSaldo(userId, bet);
        message += `Maaf, kamu kalah. Taruhan sebesar ${bet} telah dikurangkan dari saldo kamu.\n${kurangResult}`;
      } catch (error) {
        console.error("Error saat mengurangi saldo:", error);
        message += "\nTapi terjadi kesalahan saat mengurangi saldo.";
      }
    }
    
    await sock.sendMessage(userId, { text: message });
  }
  
  // Pastikan fungsi coinFlipGamble diekspor dengan benar:
  module.exports = {
    coinFlipGamble,
  };
  