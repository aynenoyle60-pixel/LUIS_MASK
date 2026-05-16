// Node.js'in hazır HTTP sunucusunu kullanıyoruz; ekstra paket kurmaya gerek kalmıyor.
const http = require("http");

// Dosya okumak/yazmak için Node.js'in dosya sistemi modülünü kullanıyoruz.
const fs = require("fs");

// Dosya yollarını Windows/Mac/Linux uyumlu oluşturmak için path modülü kullanılır.
const path = require("path");

// Sipariş, ödeme ve ürünlere benzersiz kimlik üretmek için crypto kullanıyoruz.
const crypto = require("crypto");

// Kafedeki diğer cihazların bağlanabilmesi için bilgisayarın yerel ağ IP adresini buluruz.
const os = require("os");

// Sunucunun çalışacağı port; istenirse dışarıdan PORT değişkeniyle değiştirilebilir.
const PORT = process.env.PORT || 3000;

// Tarayıcıya gönderilecek HTML, CSS ve JS dosyalarının bulunduğu klasör.
const PUBLIC_KLASORU = path.join(__dirname, "public");

// Admin, menü, masa ve ödeme verilerinin kalıcı tutulduğu JSON dosyası.
const VERI_DOSYASI = path.join(__dirname, "data.json");

// Kasa ekranlarının canlı güncelleme alması için açık bağlantıları burada tutuyoruz.
const canliBaglantilar = new Set();

// QR kodların telefonda da açılması için localhost yerine yerel ağ adresi önerir.
function yerelSunucuAdresi() {
  const aglar = os.networkInterfaces();

  for (const agAdi of Object.keys(aglar)) {
    for (const ag of aglar[agAdi] || []) {
      if (ag.family === "IPv4" && !ag.internal) {
        return `http://${ag.address}:${PORT}`;
      }
    }
  }

  return `http://localhost:${PORT}`;
}

// JSON dosyasını okuyup uygulama verisine çevirir.
function veriyiOku() {
  const hamVeri = fs.readFileSync(VERI_DOSYASI, "utf8");
  return JSON.parse(hamVeri);
}

// Değişikliklerden sonra veriyi tekrar data.json dosyasına yazar.
function veriyiKaydet(veri) {
  fs.writeFileSync(VERI_DOSYASI, JSON.stringify(veri, null, 2), "utf8");
}

// HTTP cevabını JSON olarak döndürür.
function jsonGonder(cevap, durumKodu, veri) {
  const govde = JSON.stringify(veri);
  cevap.writeHead(durumKodu, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(govde)
  });
  cevap.end(govde);
}

// POST/PATCH isteklerindeki JSON gövdesini okuyup nesneye çevirir.
function govdeyiOku(istek) {
  return new Promise((coz, reddet) => {
    let govde = "";

    // Gelen veri parça parça akabilir; her parçayı birleştiriyoruz.
    istek.on("data", (parca) => {
      govde += parca;
      if (govde.length > 8_000_000) {
        istek.destroy();
        reddet(new Error("İstek gövdesi çok büyük. Daha küçük bir görsel seçin."));
      }
    });

    // Tüm veri gelince JSON olarak okumayı deniyoruz.
    istek.on("end", () => {
      try {
        coz(govde ? JSON.parse(govde) : {});
      } catch {
        reddet(new Error("Geçersiz JSON gönderildi."));
      }
    });
  });
}

// Bir masa için toplam sipariş tutarını hesaplar.
function masaToplami(masa) {
  return masa.siparisler.reduce((toplam, siparis) => {
    if (siparis.durum === "iptal") return toplam;
    const siparisToplami = siparis.kalemler.reduce((araToplam, kalem) => {
      return araToplam + kalem.fiyat * kalem.adet;
    }, 0);
    return toplam + siparisToplami;
  }, 0);
}

// Bir masa için alınan toplam ödemeyi hesaplar.
function masaOdemesi(masa) {
  return masa.odemeler.reduce((toplam, odeme) => toplam + odeme.tutar, 0);
}

// Tarayıcıya gidecek veriye hesaplanmış toplam/kalan alanlarını ekler.
function herkeseAcikVeri(veri) {
  return {
    sunucuAdresi: yerelSunucuAdresi(),
    urunler: veri.urunler,
    masalar: veri.masalar.map((masa) => {
      const toplam = masaToplami(masa);
      const odenen = masaOdemesi(masa);
      return {
        ...masa,
        toplam,
        odenen,
        kalan: Math.max(toplam - odenen, 0)
      };
    })
  };
}

// Kasa/admin ekranlarına son durumu anlık gönderir.
function canliYayinYap() {
  const veri = veriyiOku();
  const mesaj = `data: ${JSON.stringify(herkeseAcikVeri(veri))}\n\n`;
  for (const cevap of canliBaglantilar) cevap.write(mesaj);
}

// URL içindeki masa id'sine göre masayı bulur.
function masaBul(veri, masaId) {
  return veri.masalar.find((masa) => masa.id === String(masaId));
}


// Admin girişi istek fonksiyonu
async function adminGirisiYap(sifre) {
  // BURAYA KİMSENİN TAHMİN EDEMEYECEĞİ KENDİ YENİ ŞİFRENİ YAZ (Örn: 'LuisMask2026')
  const BENIM_YENI_SIFREM = 'ruka3444_';

  if (sifre !== BENIM_YENI_SIFREM) {
    return false;
  }

  // Şifre doğruysa token oluşturup kaydet
  durum.adminToken = 'luis-mask-token-xyz';
  localStorage.setItem('adminToken', durum.adminToken);
  return true;
}

// Türkçe metni URL ve id için güvenli hale getirir.
function idUret(metin) {
  return String(metin)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

// HTML, CSS ve tarayıcı JS dosyalarını servis eder.
function statikDosyaGonder(istek, cevap) {
  const adres = new URL(istek.url, `http://${istek.headers.host}`);
  const istenenDosya = adres.pathname === "/" ? "/index.html" : adres.pathname;
  const dosyaYolu = path.normalize(path.join(PUBLIC_KLASORU, istenenDosya));

  // Klasör dışına çıkmayı engelleyerek basit güvenlik kontrolü yapıyoruz.
  if (!dosyaYolu.startsWith(PUBLIC_KLASORU)) {
    cevap.writeHead(403);
    cevap.end("Erişim reddedildi.");
    return;
  }

  fs.readFile(dosyaYolu, (hata, dosya) => {
    if (hata) {
      // Bilinmeyen sayfalarda tek sayfa uygulamanın index.html dosyasına dönüyoruz.
      fs.readFile(path.join(PUBLIC_KLASORU, "index.html"), (indexHatasi, indexDosyasi) => {
        if (indexHatasi) {
          cevap.writeHead(404);
          cevap.end("Dosya bulunamadı.");
          return;
        }
        cevap.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        cevap.end(indexDosyasi);
      });
      return;
    }

    const uzanti = path.extname(dosyaYolu);
    const tipler = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml; charset=utf-8"
    };
    cevap.writeHead(200, { "Content-Type": tipler[uzanti] || "application/octet-stream" });
    cevap.end(dosya);
  });
}

// /api ile başlayan tüm istekleri yönetir.
async function apiYonet(istek, cevap) {
  const adres = new URL(istek.url, `http://${istek.headers.host}`);
  const veri = veriyiOku();

  if (istek.method === "GET" && adres.pathname === "/api/durum") {
    jsonGonder(cevap, 200, herkeseAcikVeri(veri));
    return;
  }

  if (istek.method === "GET" && adres.pathname === "/api/canli") {
    cevap.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    cevap.write(`data: ${JSON.stringify(herkeseAcikVeri(veri))}\n\n`);
    canliBaglantilar.add(cevap);
    istek.on("close", () => canliBaglantilar.delete(cevap));
    return;
  }

  if (istek.method === "POST" && adres.pathname === "/api/siparisler") {
    const govde = await govdeyiOku(istek);
    const masa = masaBul(veri, govde.masaId);

    if (!masa) {
      jsonGonder(cevap, 404, { hata: "Masa bulunamadı." });
      return;
    }

    const kalemler = (Array.isArray(govde.kalemler) ? govde.kalemler : [])
      .map((kalem) => {
        const urun = veri.urunler.find((aday) => aday.id === kalem.id && aday.aktif);
        const adet = Number(kalem.adet);
        if (!urun || !Number.isInteger(adet) || adet <= 0) return null;
        return {
          id: urun.id,
          ad: urun.ad,
          fiyat: urun.fiyat,
          adet,
          not: String(kalem.not || "").slice(0, 140)
        };
      })
      .filter(Boolean);

    if (!kalemler.length) {
      jsonGonder(cevap, 400, { hata: "Sipariş boş olamaz." });
      return;
    }

    masa.siparisler.unshift({
      id: crypto.randomUUID(),
      durum: "yeni",
      olusturulma: new Date().toISOString(),
      kalemler
    });
    masa.durum = "acik";
    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 201, { tamam: true });
    return;
  }

  if (istek.method === "PATCH" && adres.pathname.startsWith("/api/siparisler/")) {
    const siparisId = adres.pathname.split("/").pop();
    const govde = await govdeyiOku(istek);
    const izinliDurumlar = ["yeni", "hazirlaniyor", "servis", "iptal"];
    const masa = veri.masalar.find((aday) => aday.siparisler.some((siparis) => siparis.id === siparisId));
    const siparis = masa?.siparisler.find((aday) => aday.id === siparisId);

    if (!siparis || !izinliDurumlar.includes(govde.durum)) {
      jsonGonder(cevap, 400, { hata: "Sipariş veya durum geçersiz." });
      return;
    }

    siparis.durum = govde.durum;
    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 200, { tamam: true });
    return;
  }

  if (istek.method === "POST" && adres.pathname === "/api/odemeler") {
    const govde = await govdeyiOku(istek);
    const masa = masaBul(veri, govde.masaId);
    const tutar = Number(govde.tutar);

    if (!masa || !Number.isFinite(tutar) || tutar <= 0) {
      jsonGonder(cevap, 400, { hata: "Geçerli masa ve ödeme tutarı girin." });
      return;
    }

    masa.odemeler.unshift({
      id: crypto.randomUUID(),
      tutar,
      yontem: String(govde.yontem || "Nakit").slice(0, 40),
      aciklama: String(govde.aciklama || "Genel ödeme").slice(0, 240),
      urunler: Array.isArray(govde.urunler) ? govde.urunler.map((urun) => String(urun).slice(0, 80)).slice(0, 30) : [],
      olusturulma: new Date().toISOString()
    });

    if (masaOdemesi(masa) >= masaToplami(masa)) masa.durum = "odendi";
    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 201, { tamam: true });
    return;
  }

  if (istek.method === "POST" && adres.pathname.startsWith("/api/masalar/") && adres.pathname.endsWith("/kapat")) {
    const masaId = adres.pathname.split("/")[3];
    const masa = masaBul(veri, masaId);
    if (!masa) {
      jsonGonder(cevap, 404, { hata: "Masa bulunamadı." });
      return;
    }
    masa.siparisler = [];
    masa.odemeler = [];
    masa.durum = "acik";
    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 200, { tamam: true });
    return;
  }

  if (istek.method === "POST" && adres.pathname === "/api/admin/giris") {
    const govde = await govdeyiOku(istek);
    jsonGonder(cevap, 200, { tamam: govde.sifre === veri.adminSifresi });
    return;
  }

  if (adres.pathname.startsWith("/api/admin/") && !adminMi(veri, istek)) {
    jsonGonder(cevap, 401, { hata: "Admin şifresi gerekli." });
    return;
  }

  if (istek.method === "POST" && adres.pathname === "/api/admin/urunler") {
    const govde = await govdeyiOku(istek);
    const ad = String(govde.ad || "").trim();
    const kategori = String(govde.kategori || "Genel").trim();
    const fiyat = Number(govde.fiyat);
    const gorsel = String(govde.gorsel || "").trim();
    if (!ad || !Number.isFinite(fiyat) || fiyat <= 0) {
      jsonGonder(cevap, 400, { hata: "Ürün adı ve fiyat zorunlu." });
      return;
    }

    const idTabani = idUret(ad) || "urun";
    let id = idTabani;
    let sayac = 2;
    while (veri.urunler.some((urun) => urun.id === id)) {
      id = `${idTabani}-${sayac}`;
      sayac += 1;
    }

    veri.urunler.push({ id, ad, kategori, fiyat, aktif: true, gorsel });
    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 201, { tamam: true });
    return;
  }

  if (istek.method === "PATCH" && adres.pathname.startsWith("/api/admin/urunler/")) {
    const urunId = decodeURIComponent(adres.pathname.split("/").pop());
    const govde = await govdeyiOku(istek);
    const urun = veri.urunler.find((aday) => aday.id === urunId);
    if (!urun) {
      jsonGonder(cevap, 404, { hata: "Ürün bulunamadı." });
      return;
    }

    if (govde.ad !== undefined) urun.ad = String(govde.ad).trim() || urun.ad;
    if (govde.kategori !== undefined) urun.kategori = String(govde.kategori).trim() || urun.kategori;
    if (govde.fiyat !== undefined && Number(govde.fiyat) > 0) urun.fiyat = Number(govde.fiyat);
    if (govde.aktif !== undefined) urun.aktif = Boolean(govde.aktif);
    if (govde.gorsel !== undefined) urun.gorsel = String(govde.gorsel).trim();

    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 200, { tamam: true });
    return;
  }

  if (istek.method === "POST" && adres.pathname === "/api/admin/masalar") {
    const govde = await govdeyiOku(istek);
    const ad = String(govde.ad || "").trim();
    const kullanilanNumaralar = veri.masalar.map((masa) => Number(masa.id)).filter(Number.isFinite);
    const siradakiNumara = kullanilanNumaralar.length ? Math.max(...kullanilanNumaralar) + 1 : 1;
    const id = String(siradakiNumara);

    veri.masalar.push({
      id,
      ad: ad || `Masa ${id}`,
      durum: "acik",
      siparisler: [],
      odemeler: []
    });

    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 201, { tamam: true });
    return;
  }

  if (istek.method === "PATCH" && adres.pathname.startsWith("/api/admin/masalar/")) {
    const masaId = decodeURIComponent(adres.pathname.split("/").pop());
    const govde = await govdeyiOku(istek);
    const masa = masaBul(veri, masaId);

    if (!masa) {
      jsonGonder(cevap, 404, { hata: "Masa bulunamadı." });
      return;
    }

    if (govde.ad !== undefined) masa.ad = String(govde.ad).trim() || masa.ad;

    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 200, { tamam: true });
    return;
  }

  if (istek.method === "DELETE" && adres.pathname.startsWith("/api/admin/masalar/")) {
    const masaId = decodeURIComponent(adres.pathname.split("/").pop());
    const masa = masaBul(veri, masaId);

    if (!masa) {
      jsonGonder(cevap, 404, { hata: "Masa bulunamadı." });
      return;
    }

    if (masa.siparisler.length || masa.odemeler.length) {
      jsonGonder(cevap, 400, { hata: "Sipariş veya ödeme bulunan masa silinemez. Önce kasadan masayı kapatın." });
      return;
    }

    veri.masalar = veri.masalar.filter((aday) => aday.id !== masaId);
    veriyiKaydet(veri);
    canliYayinYap();
    jsonGonder(cevap, 200, { tamam: true });
    return;
  }

  jsonGonder(cevap, 404, { hata: "Endpoint bulunamadı." });
}

// Ana HTTP sunucusu burada başlar; API isteklerini ve statik dosyaları ayırır.
const sunucu = http.createServer((istek, cevap) => {
  if (istek.url.startsWith("/api/")) {
    apiYonet(istek, cevap).catch((hata) => {
      jsonGonder(cevap, 500, { hata: hata.message || "Sunucu hatası." });
    });
    return;
  }
  statikDosyaGonder(istek, cevap);
});

// Sunucuyu belirtilen portta çalıştırır ve terminale ön izleme adresini yazar.
sunucu.listen(PORT, '0.0.0.0', () => {
    console.log(`Luis Mask Sunucusu ${PORT} portunda başarıyla internete açıldı!`);
});