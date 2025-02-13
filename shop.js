// shop.js

// Daftar item yang tersedia di shop
const shopItems = [
    { id: 1, name: "XP Booster", description: "Dapatkan 2x XP selama 1 jam.", price: 500 },
    { id: 2, name: "Mystery Box", description: "Buka untuk mendapatkan hadiah acak!", price: 1000 },
    { id: 3, name: "Lottery Ticket", description: "Tiket undian harian.", price: 200 },
    { id: 4, name: "VIP Membership", description: "Akses fitur premium selama 24 jam.", price: 5000 },
    { id: 5, name: "Avatar Frame", description: "Frame khusus untuk profil kamu.", price: 800 },
    // Tambahkan item lain sesuai kreativitas Anda
  ];
  
  // Fungsi untuk mengambil semua item di shop
  function getShopItems() {
    return shopItems;
  }
  
  // Fungsi untuk mengambil item berdasarkan ID
  function getItemById(id) {
    return shopItems.find(item => item.id === id);
  }
  
  module.exports = { getShopItems, getItemById };
  