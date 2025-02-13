const { getSaldo, tambahSaldo, kurangSaldo } = require('./database');

function tebakAngka(userId, tebakan, taruhan) {
    let angkaBenar = Math.floor(Math.random() * 10) + 1; // Angka acak antara 1-10
    let saldoUser = getSaldo(userId);

    if (saldoUser < taruhan) {
        return `Saldo tidak cukup! Saldo kamu: ${saldoUser}`;
    }

    // Kurangi saldo untuk taruhan
    if (!kurangSaldo(userId, taruhan)) {
        return `Gagal mengurangi saldo. Pastikan saldo cukup.`;
    }

    if (tebakan === angkaBenar) {
        let hadiah = taruhan * 2; // Hadiah 2x lipat dari taruhan
        tambahSaldo(userId, hadiah);
        return `🎉 Selamat! Jawaban benar. Kamu menang ${hadiah}! Saldo sekarang: ${getSaldo(userId)}`;
    } else {
        return `❌ Jawaban salah! Angka yang benar: ${angkaBenar}. Saldo sekarang: ${getSaldo(userId)}`;
    }
}

module.exports = { tebakAngka };
