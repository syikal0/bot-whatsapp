// welcome.js

module.exports = async (client, update) => {
    try {
      // Pastikan hanya memproses jika aksi adalah 'add'
      if (update.action !== 'add') return;
  
      // Ambil metadata grup untuk mendapatkan nama grup
      const groupMetadata = await client.groupMetadata(update.id);
      const groupName = groupMetadata.subject;
  
      // Loop untuk setiap participant yang ditambahkan
      for (const participant of update.participants) {
        // Buat pesan selamat datang dengan mention
        const welcomeMsg = `Halo @${participant.split('@')[0]},Haiii! selamat datang di grup *${groupName}*!\nSemoga betah yawwww :3.`;
        
        // Kirim pesan ke grup dengan menyertakan mention ke participant baru
        await client.sendMessage(
          update.id, // ID grup
          { text: welcomeMsg, mentions: [participant] }
        );
      }
    } catch (error) {
      console.error('Terjadi kesalahan saat mengirim pesan selamat datang:', error);
    }
  };
  