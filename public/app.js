// Sayfanın bütün içeriğini bu ana kutunun içine basıyoruz.
const uygulama = document.querySelector("#uygulama");

// Uygulama içinde değişen bilgileri tek yerde tutuyoruz.
const durum = {
  ekran: new URLSearchParams(location.search).get("view") || "menu",
  masaId: new URLSearchParams(location.search).get("table") || "1",
  kasaMasaId: "1",
  kategori: "Tümü",
  sepet: {},
  veri: { sunucuAdresi: "", urunler: [], masalar: [] },
  adminSifresi: localStorage.getItem("adminSifresi") || "",
  SepetAcik:false // yeni: sepetin açık olma durumunu kontrol eder.
};

// Sipariş durumlarını kullanıcıya Türkçe ve okunabilir göstermek için sözlük kullanıyoruz.
const durumYazilari = {
  yeni: "Yeni",
  hazirlaniyor: "Hazırlanıyor",
  servis: "Servis edildi",
  iptal: "İptal",
  acik: "Açık",
  odendi: "Ödendi"
};

// Para değerlerini Türk Lirası formatında göstermek için Intl kullanıyoruz.
const para = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0
});

// Checkbox değerinde ürün bilgisini güvenli taşımak için JSON'u URL koduna çevirir.
function odemeKalemiKodla(kalem) {
  return encodeURIComponent(JSON.stringify(kalem));
}

// Checkbox'tan gelen kodlu ürün bilgisini tekrar nesneye çevirir.
function odemeKalemiCoz(hamDeger) {
  return JSON.parse(decodeURIComponent(hamDeger));
}

// Admin panelinde seçilen görsel dosyasını tarayıcıda okunabilir veri adresine çevirir.
function dosyayiGorseleCevir(dosya) {
  return new Promise((coz, reddet) => {
    if (!dosya) {
      coz("");
      return;
    }

    if (!dosya.type.startsWith("image/")) {
      reddet(new Error("Lütfen görsel dosyası seçin."));
      return;
    }

    if (dosya.size > 2_000_000) {
      reddet(new Error("Görsel 2 MB'dan küçük olmalı."));
      return;
    }

    const okuyucu = new FileReader();
    okuyucu.onload = () => coz(okuyucu.result);
    okuyucu.onerror = () => reddet(new Error("Görsel okunamadı."));
    okuyucu.readAsDataURL(dosya);
  });
}

// Her kategoriye Luis Mask kimliğine uygun küçük bir maske görseli bağlar.
function kategoriGorseli(kategori) {
  const gorseller = {
    "Sahne Kahveleri": "/assets/kategori-kahve.svg",
    "Maskeli Tatlılar": "/assets/kategori-tatli.svg",
    "Çocuk Menüsü": "/assets/kategori-cocuk.svg",
    "Gizli Tarifler": "/assets/kategori-gizli.svg"
  };
  return gorseller[kategori] || "/assets/loise-mask-logo.svg";
}

// API isteği atar; hata gelirse ekranda anlaşılır mesaj gösterebilmek için Error fırlatır.
async function api(rota, secenekler = {}) {
  const cevap = await fetch(rota, {
    headers: { "Content-Type": "application/json", "x-admin-sifre": durum.adminSifresi },
    ...secenekler
  });
  const govde = await cevap.json();
  if (!cevap.ok) throw new Error(govde.hata || "İşlem tamamlanamadı.");
  return govde;
}

// Ekran değiştirince URL'yi de güncelliyoruz; böylece link paylaşılabilir oluyor.
function ekranaGit(ekran) {
  durum.ekran = ekran;
  const parametreler = new URLSearchParams(location.search);
  parametreler.set("view", ekran);
  if (ekran === "menu") parametreler.set("table", durum.masaId);
  history.replaceState(null, "", `?${parametreler.toString()}`);
  ekraniCiz();
}

// Sepetteki ürünleri diziye çevirir; toplam hesaplamak ve liste basmak kolaylaşır.
function sepetKalemleri() {
  return Object.values(durum.sepet);
}

// Sepetteki toplam tutarı hesaplar.
function sepetToplami() {
  return sepetKalemleri().reduce((toplam, kalem) => toplam + kalem.fiyat * kalem.adet, 0);
}

// Ürünü sepete ekler veya azaltır.
function sepetiGuncelle(urun, fark) {
  const mevcut = durum.sepet[urun.id] || { ...urun, adet: 0, not: "" };
  mevcut.adet += fark;

  if (mevcut.adet <= 0) delete durum.sepet[urun.id];
  else durum.sepet[urun.id] = mevcut;

  ekraniCiz();
}

// Sepetteki ürün notunu kaydeder.
function urunNotuYaz(urunId, not) {
  if (durum.sepet[urunId]) durum.sepet[urunId].not = not;
}

// Müşterinin sepetini sunucuya sipariş olarak gönderir.
async function siparisGonder() {
  const kalemler = sepetKalemleri().map((kalem) => ({
    id: kalem.id,
    adet: kalem.adet,
    not: kalem.not
  }));

  await api("/api/siparisler", {
    method: "POST",
    body: JSON.stringify({ masaId: durum.masaId, kalemler })
  });

  durum.sepet = {};
  ekraniCiz();
}

// Kasa ekranında sipariş durumunu değiştirir.
async function siparisDurumuDegistir(siparisId, yeniDurum) {
  await api(`/api/siparisler/${siparisId}`, {
    method: "PATCH",
    body: JSON.stringify({ durum: yeniDurum })
  });
}

// Kasa ekranından masa ödemesi alır.
async function odemeAl(olay) {
  olay.preventDefault();
  const form = new FormData(olay.currentTarget);
  const secilenUrunler = form.getAll("odemeKalemi").map(odemeKalemiCoz);
  const urunAdlari = secilenUrunler.map((kalem) => kalem.ad);
  const aciklama = urunAdlari.length ? urunAdlari.join(", ") : "Genel ödeme";

  await api("/api/odemeler", {
    method: "POST",
    body: JSON.stringify({
      masaId: durum.kasaMasaId,
      tutar: Number(form.get("tutar")),
      yontem: form.get("yontem"),
      aciklama,
      urunler: urunAdlari
    })
  });

  olay.currentTarget.reset();
}

// Ödeme bitince veya yanlış kayıt temizleneceği zaman masayı sıfırlar.
async function masayiKapat(masaId) {
  await api(`/api/masalar/${masaId}/kapat`, { method: "POST" });
}

// Kasa ekranında hangi ürünlerin ödeneceğini seçebilmek için sipariş kalemlerini düz listeye çevirir.
function odemeKalemleriHazirla(masa) {
  if (!masa) return [];

  return masa.siparisler
    .filter((siparis) => siparis.durum !== "iptal")
    .flatMap((siparis) =>
      siparis.kalemler.map((kalem, sira) => ({
        anahtar: `${siparis.id}-${sira}`,
        ad: `${kalem.adet} x ${kalem.ad}`,
        tutar: kalem.fiyat * kalem.adet
      }))
    );
}

// Ödeme ekranında seçilen ürünlerin toplamını tutar alanına otomatik yazar.
function odemeTutariGuncelle() {
  const form = document.querySelector("#odemeFormu");
  if (!form) return;

  const secilenler = new FormData(form).getAll("odemeKalemi").map(odemeKalemiCoz);
  const toplam = secilenler.reduce((araToplam, kalem) => araToplam + Number(kalem.tutar), 0);
  if (toplam > 0) form.elements.tutar.value = toplam;
}

// Admin girişini kontrol eder ve doğruysa şifreyi tarayıcıda saklar.
async function adminGirisiYap(olay) {
  olay.preventDefault();
  const form = new FormData(olay.currentTarget);
  const sifre = String(form.get("sifre") || "");
  const sonuc = await api("/api/admin/giris", {
    method: "POST",
    body: JSON.stringify({ sifre })
  });

  if (!sonuc.tamam) {
    alert("Admin şifresi hatalı.");
    return;
  }

  durum.adminSifresi = sifre;
  localStorage.setItem("adminSifresi", sifre);
  ekraniCiz();
}

// Admin panelinden yeni ürün ekler.
async function urunEkle(olay) {
  olay.preventDefault();
  const form = new FormData(olay.currentTarget);
  const gorselDosyasi = form.get("gorselDosyasi");
  const yuklenenGorsel = await dosyayiGorseleCevir(gorselDosyasi);

  await api("/api/admin/urunler", {
    method: "POST",
    body: JSON.stringify({
      ad: form.get("ad"),
      kategori: form.get("kategori"),
      fiyat: Number(form.get("fiyat")),
      gorsel: yuklenenGorsel || form.get("gorsel")
    })
  });

  olay.currentTarget.reset();
}

// Admin panelinden ürün bilgilerini günceller.
async function urunGuncelle(urunId, alanlar) {
  await api(`/api/admin/urunler/${encodeURIComponent(urunId)}`, {
    method: "PATCH",
    body: JSON.stringify(alanlar)
  });
}

// Admin panelinden yeni masa ekler; QR ekranı bu listeye göre otomatik çoğalır.
async function masaEkle(olay) {
  olay.preventDefault();
  const form = new FormData(olay.currentTarget);

  await api("/api/admin/masalar", {
    method: "POST",
    body: JSON.stringify({ ad: form.get("ad") })
  });

  olay.currentTarget.reset();
}

// Admin panelinden masa adını günceller.
async function masaGuncelle(masaId, alanlar) {
  await api(`/api/admin/masalar/${encodeURIComponent(masaId)}`, {
    method: "PATCH",
    body: JSON.stringify(alanlar)
  });
}

// Boş masayı sistemden kaldırır.
async function masaSil(masaId) {
  await api(`/api/admin/masalar/${encodeURIComponent(masaId)}`, {
    method: "DELETE"
  });
}

// Masa linkini üretir; QR kodların içine bu adres yazılır.
function masaLinki(masaId) {
  const yerelErisimAdresi =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? durum.veri.sunucuAdresi || location.origin
      : location.origin;

  return `${yerelErisimAdresi}${location.pathname}?view=menu&table=${masaId}`;
}

// QR görselini ücretsiz QR servisinden üretir.
function qrGorseli(masaId) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(masaLinki(masaId))}`;
}

// Üst menü ve ortak sayfa iskeletini çizer.
function iskeletiCiz(icerik) {
  uygulama.innerHTML = `
    <header class="ust-serit">
      <div class="marka">
        <span class="marka-isareti">QR</span>
        <div>
          <h1>Luis Mask</h1>
          <p>Konsept kafe sipariş sistemi</p>
        </div>
      </div>
      <nav class="sekmeler" aria-label="Ekranlar">
        <button class="sekme ${durum.ekran === "menu" ? "aktif" : ""}" data-ekran="menu">Müşteri</button>
        <button class="sekme ${durum.ekran === "cashier" ? "aktif" : ""}" data-ekran="cashier">Kasa</button>
        <button class="sekme ${durum.ekran === "admin" ? "aktif" : ""}" data-ekran="admin">Admin</button>
        <button class="sekme ${durum.ekran === "qr" ? "aktif" : ""}" data-ekran="qr">QR</button>
      </nav>
    </header>
    <main class="ana-alan">${icerik}</main>
  `;

  document.querySelectorAll("[data-ekran]").forEach((buton) => {
    buton.addEventListener("click", () => ekranaGit(buton.dataset.ekran));
  });
}

// Müşteri menüsünü ve sepeti çizer.
function menuEkraniCiz() {
  const aktifUrunler = durum.veri.urunler.filter((urun) => urun.aktif);
  const kategoriler = ["Tümü", ...new Set(aktifUrunler.map((urun) => urun.kategori))];
  const gosterilecekUrunler =
    durum.kategori === "Tümü" ? aktifUrunler : aktifUrunler.filter((urun) => urun.kategori === durum.kategori);

  const toplamUrunAdeti = sepetKalemleri().reduce((toplam, kalem) => toplam + kalem.adet, 0);

  iskeletiCiz(`
    <section class="musteri-kahraman">
      <div class="kahraman-yazi">
        <span class="mini-etiket">Luis Mask</span>
        <h2>Masa ${durum.masaId} için zarif bir mola</h2>
        <p>Güven veren servis, lezzetli tarifler, umutlu bir atmosfer ve eğlenceli küçük detaylar.</p>
      </div>
      <div class="kahraman-vitrin" aria-hidden="true">
        <img src="https://images.unsplash.com/photo-1751956066306-c5684cbcf385?auto=format&fit=crop&w=1400&q=80" alt="" />
      </div>
    </section>
    
    <div class="kategori-vitrini">
      ${kategoriler.filter((kategori) => kategori !== "Tümü").map((kategori) => `
        <button class="kategori-karti ${kategori === durum.kategori ? "aktif" : ""}" data-kategori="${kategori}">
          <img src="${kategoriGorseli(kategori)}" alt="${kategori} görseli" />
          <span>${kategori}</span>
        </button>
      `).join("")}
    </div>
    
    <div class="ana-menu-kapsayici" style="padding: 10px; box-sizing: border-box;">
      <section class="panel">
        <div class="bolum-basligi">
          <div>
            <h2>Luis Mask Menüsü</h2>
            <p>Masanız için lezzetli ürünler seçin.</p>
          </div>
          <select class="secim" id="masaSecimi">
            ${durum.veri.masalar.map((masa) => `<option value="${masa.id}" ${masa.id === durum.masaId ? "selected" : ""}>${masa.ad}</option>`).join("")}
          </select>
        </div>
        <div class="kategori-satiri">
          ${kategoriler.map((kategori) => `<button class="etiket ${kategori === durum.kategori ? "aktif" : ""}" data-kategori="${kategori}">${kategori}</button>`).join("")}
        </div>
        <div class="urun-izgarasi">
          ${gosterilecekUrunler.map((urun) => `
            <article class="urun-karti">
              <div class="urun-gorseli">
                ${urun.gorsel ? `<img src="${urun.gorsel}" alt="${urun.ad} görseli" />` : `<span>Görsel yok</span>`}
              </div>
              <div>
                <h3>${urun.ad}</h3>
                <p class="yardimci-yazi">${urun.kategori}</p>
              </div>
              <div class="satir">
                <span class="fiyat">${para.format(urun.fiyat)}</span>
                <button class="buton" data-ekle="${urun.id}">Ekle</button>
              </div>
            </article>
          `).join("")}
        </div>
      </section>

      <div class="sepet-arka-plan" id="sepetModal" style="display: ${durum.sepetAcik ? 'flex' : 'none'}; position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.6); z-index: 9999; justify-content: center; align-items: flex-end; box-sizing: border-box;">
        <aside class="panel sepet-paneli" style="width: 100%; max-width: 500px; max-height: 80vh; overflow-y: auto; background: #fff; border-radius: 20px 20px 0 0; padding: 25px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; box-shadow: 0 -5px 25px rgba(0,0,0,0.2);">
          
          <button id="sepetiKapatBtn" style="position: absolute; top: 15px; right: 15px; background: #f0f0f0; border: none; font-size: 16px; font-weight: bold; width: 35px; height: 35px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #333;">✕</button>

          <div class="bolum-basligi" style="margin-bottom: 15px;">
            <div>
              <h3 style="margin:0; font-size:20px;">Sipariş Listesi</h3>
              <p style="margin:5px 0 0 0; color:#666;">${sepetKalemleri().length ? `${sepetKalemleri().length} farklı ürün seçildi` : "Sepetiniz boş"}</p>
            </div>
          </div>
          
          <div class="liste" style="flex: 1; overflow-y: auto; margin-bottom: 20px;">
            ${sepetKalemleri().length ? sepetKalemleri().map((kalem) => `
              <div class="sepet-kalemi" style="border-bottom: 1px solid #eee; padding: 15px 0; display:flex; flex-direction:column; gap:8px;">
                <div class="satir" style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <strong style="font-size:16px;">${kalem.ad}</strong>
                    <div class="yardimci-yazi" style="color:#888; font-size:13px; margin-top:2px;">${para.format(kalem.fiyat)} x ${kalem.adet}</div>
                  </div>
                  <div class="adet-kutusu" style="display:flex; align-items:center; gap:12px; background:#f5f5f5; padding:5px 10px; border-radius:20px;">
                    <button class="kucuk-buton" data-azalt="${kalem.id}" style="border:none; background:none; font-size:18px; font-weight:bold; cursor:pointer; padding:0 5px;">-</button>
                    <strong style="font-size:16px;">${kalem.adet}</strong>
                    <button class="kucuk-buton" data-artir="${kalem.id}" style="border:none; background:none; font-size:18px; font-weight:bold; cursor:pointer; padding:0 5px;">+</button>
                  </div>
                </div>
                <textarea class="not-alani" data-not="${kalem.id}" placeholder="Masa notu: Az buzlu, şekersiz..." style="width:100%; min-height:40px; border:1px solid #ddd; border-radius:8px; padding:8px; box-sizing:border-box; font-family:inherit; resize:none;">${kalem.not || ""}</textarea>
              </div>
            `).join("") : `<div class="bos" style="text-align:center; padding: 40px 20px; color:#999;">Sepetiniz şu an boş. Menüden ekleme yapın.</div>`}
          </div>
          
          <div class="toplamlar" style="border-top:1px solid #eee; padding-top:15px;">
            <div class="toplam-satiri" style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:18px;">
              <span>Toplam Tutar:</span>
              <strong style="color:#8b0000; font-size:20px;">${para.format(sepetToplami())}</strong>
            </div>
            <button class="buton tam" id="siparisGonder" ${sepetKalemleri().length ? "" : "disabled"} style="width:100%; background:#8b0000; color:#fff; border:none; padding:15px; border-radius:10px; font-size:16px; font-weight:bold; cursor:pointer;">Siparişi Gönder</button>
          </div>
        </aside>
      </div>
    </div>

    ${toplamUrunAdeti > 0 ? `
      <button id="sepetiAcBtn" style="position: fixed; bottom: 30px; right: 25px; background: #8b0000; color: white; border: none; padding: 15px 25px; border-radius: 50px; font-weight: bold; box-shadow: 0 5px 20px rgba(0,0,0,0.4); z-index: 9998; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 16px; border: 2px solid rgba(255,255,255,0.2);">
        🛒 Sepeti Gör <span style="background: white; color: #8b0000; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight:bolder;">${toplamUrunAdeti}</span>
      </button>
    ` : ""}
  `);

  document.querySelector("#masaSecimi").addEventListener("change", (olay) => {
    durum.masaId = olay.target.value;
    durum.sepet = {};
    ekranaGit("menu");
  });

  document.querySelectorAll("[data-kategori]").forEach((buton) => {
    buton.addEventListener("click", () => {
      durum.kategori = buton.dataset.kategori;
      ekraniCiz();
    });
  });

  document.querySelectorAll("[data-ekle], [data-artir]").forEach((buton) => {
    buton.addEventListener("click", () => {
      const urun = durum.veri.urunler.find((aday) => aday.id === (buton.dataset.ekle || buton.dataset.artir));
      sepetiGuncelle(urun, 1);
    });
  });

  document.querySelectorAll("[data-azalt]").forEach((buton) => {
    buton.addEventListener("click", () => {
      const urun = durum.veri.urunler.find((aday) => aday.id === buton.dataset.azalt);
      sepetiGuncelle(urun, -1);
    });
  });

  document.querySelectorAll("[data-not]").forEach((alan) => {
    alan.addEventListener("input", () => urunNotuYaz(alan.dataset.not, alan.value));
  });

  document.querySelector("#sepetiAcBtn")?.addEventListener("click", () => {
    durum.sepetAcik = true;
    ekraniCiz();
  });

  document.querySelector("#sepetiKapatBtn")?.addEventListener("click", () => {
    durum.sepetAcik = false;
    ekraniCiz();
  });

  document.querySelector("#sepetModal")?.addEventListener("click", (olay) => {
    if (olay.target.id === "sepetModal") {
      durum.sepetAcik = false;
      ekraniCiz();
    }
  });

  document.querySelector("#siparisGonder").addEventListener("click", async () => {
    durum.sepetAcik = false;
    await siparisGonder();
  });
}
// Kasa ekranını çizer; sipariş ve ödeme işlemleri buradan yönetilir.
function kasaEkraniCiz() {
  const seciliMasa = durum.veri.masalar.find((masa) => masa.id === durum.kasaMasaId) || durum.veri.masalar[0];
  if (seciliMasa) durum.kasaMasaId = seciliMasa.id;
  const odemeKalemleri = odemeKalemleriHazirla(seciliMasa);

  iskeletiCiz(`
    <div class="izgara kasa-duzeni">
      <aside class="panel">
        <div class="bolum-basligi">
          <div>
            <h2>Masalar</h2>
            <p>Masa hesabı ve kalan tutar</p>
          </div>
        </div>
        <div class="liste">
          ${durum.veri.masalar.map((masa) => `
            <button class="masa-karti ${masa.id === durum.kasaMasaId ? "aktif" : ""}" data-kasa-masa="${masa.id}">
              <div class="satir">
                <strong>${masa.ad}</strong>
                <span class="durum ${masa.durum}">${masa.durum === "odendi" ? "Ödendi" : para.format(masa.kalan)}</span>
              </div>
              <div class="yardimci-yazi">${masa.siparisler.length} sipariş, ${para.format(masa.toplam)} toplam</div>
            </button>
          `).join("")}
        </div>
      </aside>
      <section class="panel">
        ${seciliMasa ? `
          <div class="bolum-basligi">
            <div>
              <h2>${seciliMasa.ad}</h2>
              <p>${para.format(seciliMasa.odenen)} ödendi, ${para.format(seciliMasa.kalan)} kalan</p>
            </div>
            <button class="buton tehlike" data-masa-kapat="${seciliMasa.id}">Masayı Kapat</button>
          </div>
          <div class="toplamlar">
            <div class="toplam-satiri"><span>Toplam</span><strong>${para.format(seciliMasa.toplam)}</strong></div>
            <div class="toplam-satiri"><span>Kalan</span><strong>${para.format(seciliMasa.kalan)}</strong></div>
          </div>
          <form class="odeme-formu" id="odemeFormu">
            <div class="odeme-bilgi">
              <strong>Bu alan tahsilat kaydıdır</strong>
              <span>Kart, banka QR veya online ödeme için banka/POS/ödeme kuruluşu anlaşması gerekir. Burada alınan ödeme yöntemi ve tutarı kaydedilir.</span>
            </div>
            <div class="odeme-urunleri">
              <strong>Ödenecek ürünler</strong>
              <p class="yardimci-yazi">Parçalı ödeme için ürünleri seçin; tutar otomatik hesaplanır.</p>
              <div class="liste">
                ${odemeKalemleri.length ? odemeKalemleri.map((kalem) => `
                  <label class="secilebilir-kalem">
                    <input type="checkbox" name="odemeKalemi" value="${odemeKalemiKodla({ ad: kalem.ad, tutar: kalem.tutar })}" />
                    <span>${kalem.ad}</span>
                    <strong>${para.format(kalem.tutar)}</strong>
                  </label>
                `).join("") : `<div class="bos">Ödenecek ürün yok.</div>`}
              </div>
            </div>
            <input class="girdi" name="tutar" type="number" min="1" step="1" placeholder="Tutar" value="${seciliMasa.kalan || ""}" required />
            <select class="secim" name="yontem">
              <option>Nakit</option>
              <option>POS / Kredi Kartı</option>
              <option>Banka QR / EFT</option>
              <option>Online Ödeme Kaydı</option>
            </select>
            <button class="buton">Tahsilatı Kaydet</button>
          </form>
          <div class="bolum-basligi" style="margin-top: 22px;"><h3>Siparişler</h3></div>
          <div class="liste">
            ${seciliMasa.siparisler.length ? seciliMasa.siparisler.map((siparis) => `
              <article class="siparis-karti">
                <div class="satir">
                  <strong>${new Date(siparis.olusturulma).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</strong>
                  <span class="durum ${siparis.durum}">${durumYazilari[siparis.durum]}</span>
                </div>
                ${siparis.kalemler.map((kalem) => `
                  <div class="satir">
                    <span>${kalem.adet} x ${kalem.ad}${kalem.not ? ` - ${kalem.not}` : ""}</span>
                    <strong>${para.format(kalem.fiyat * kalem.adet)}</strong>
                  </div>
                `).join("")}
                <div class="islem-satiri">
                  <button class="buton ikincil" data-siparis-durum="${siparis.id}:hazirlaniyor">Hazırlanıyor</button>
                  <button class="buton ikincil" data-siparis-durum="${siparis.id}:servis">Servis edildi</button>
                  <button class="buton tehlike" data-siparis-durum="${siparis.id}:iptal">İptal</button>
                </div>
              </article>
            `).join("") : `<div class="bos">Bu masada henüz sipariş yok.</div>`}
          </div>
          <div class="bolum-basligi" style="margin-top: 22px;"><h3>Ödeme Kayıtları</h3></div>
          <div class="liste">
            ${seciliMasa.odemeler.length ? seciliMasa.odemeler.map((odeme) => `
              <div class="odeme-satiri">
                <div class="satir">
                  <strong>${para.format(odeme.tutar)}</strong>
                  <span>${odeme.yontem}</span>
                </div>
                <p class="yardimci-yazi">${odeme.aciklama || "Genel ödeme"}</p>
              </div>
            `).join("") : `<div class="bos">Bu masada ödeme kaydı yok.</div>`}
          </div>
        ` : `<div class="bos">Masa bulunamadı.</div>`}
      </section>
    </div>
  `);

  document.querySelectorAll("[data-kasa-masa]").forEach((buton) => {
    buton.addEventListener("click", () => {
      durum.kasaMasaId = buton.dataset.kasaMasa;
      ekraniCiz();
    });
  });

  document.querySelector("#odemeFormu")?.addEventListener("submit", odemeAl);

  document.querySelectorAll("[name='odemeKalemi']").forEach((secim) => {
    secim.addEventListener("change", odemeTutariGuncelle);
  });

  document.querySelectorAll("[data-siparis-durum]").forEach((buton) => {
    buton.addEventListener("click", () => {
      const [siparisId, yeniDurum] = buton.dataset.siparisDurum.split(":");
      siparisDurumuDegistir(siparisId, yeniDurum);
    });
  });

  document.querySelector("[data-masa-kapat]")?.addEventListener("click", (olay) => {
    masayiKapat(olay.currentTarget.dataset.masaKapat);
  });
}

// Admin panelini çizer; kod bilmeden ürün ekleme/düzenleme buradan yapılır.
function adminEkraniCiz() {
  if (!durum.adminSifresi) {
    iskeletiCiz(`
      <section class="panel">
        <div class="bolum-basligi">
          <div>
            <h2>Admin Girişi</h2>
            <p>Varsayılan şifre: 1234</p>
          </div>
        </div>
        <form class="admin-formu" id="adminGirisFormu">
          <input class="girdi" name="sifre" type="password" placeholder="Admin şifresi" required />
          <button class="buton">Giriş Yap</button>
        </form>
      </section>
    `);
    document.querySelector("#adminGirisFormu").addEventListener("submit", adminGirisiYap);
    return;
  }

  iskeletiCiz(`
    <section class="panel">
      <div class="bolum-basligi">
        <div>
          <h2>Admin Paneli</h2>
          <p>Menü ürünlerini kod açmadan buradan yönetin.</p>
        </div>
        <button class="buton ikincil" id="adminCikis">Çıkış</button>
      </div>
      <form class="admin-formu" id="urunEkleFormu">
        <input class="girdi" name="ad" placeholder="Ürün adı" required />
        <input class="girdi" name="kategori" placeholder="Kategori" required />
        <input class="girdi" name="fiyat" type="number" min="1" step="1" placeholder="Fiyat" required />
        <input class="girdi" name="gorselDosyasi" type="file" accept="image/*" />
        <input class="girdi" name="gorsel" placeholder="Görsel URL yedeği" />
        <button class="buton">Ürün Ekle</button>
      </form>
      <div class="liste" style="margin-top: 18px;">
        ${durum.veri.urunler.map((urun) => `
          <article class="admin-karti">
            <div class="admin-onizleme">
              <img src="${urun.gorsel || "/assets/loise-mask-logo.svg"}" alt="${urun.ad} görseli" />
              <span>Mevcut görsel</span>
            </div>
            <div class="admin-formu">
              <input class="girdi" value="${urun.ad}" data-urun-ad="${urun.id}" />
              <input class="girdi" value="${urun.kategori}" data-urun-kategori="${urun.id}" />
              <input class="girdi" type="number" min="1" step="1" value="${urun.fiyat}" data-urun-fiyat="${urun.id}" />
              <input class="girdi" type="file" accept="image/*" data-urun-gorsel-dosyasi="${urun.id}" />
              <input class="girdi" value="${urun.gorsel || ""}" data-urun-gorsel="${urun.id}" placeholder="Görsel URL yedeği" />
              <button class="buton ${urun.aktif ? "ikincil" : ""}" data-urun-aktif="${urun.id}:${urun.aktif ? "false" : "true"}">
                ${urun.aktif ? "Pasif Yap" : "Aktif Yap"}
              </button>
            </div>
            <p class="yardimci-yazi">Durum: <span class="durum ${urun.aktif ? "acik" : "pasif"}">${urun.aktif ? "Aktif" : "Pasif"}</span></p>
          </article>
        `).join("")}
      </div>
      <div class="bolum-basligi" style="margin-top: 28px;">
        <div>
          <h2>Masa Yönetimi</h2>
          <p>Masa ekleyip çıkarınca QR ekranı otomatik güncellenir.</p>
        </div>
      </div>
      <form class="masa-formu" id="masaEkleFormu">
        <input class="girdi" name="ad" placeholder="Masa adı: Bahçe 1, Teras 3..." />
        <button class="buton">Masa Ekle</button>
      </form>
      <div class="masa-admin-izgarasi">
        ${durum.veri.masalar.map((masa) => `
          <article class="masa-admin-karti">
            <input class="girdi" value="${masa.ad}" data-masa-ad="${masa.id}" />
            <div class="yardimci-yazi">${masa.siparisler.length} sipariş, ${para.format(masa.toplam || 0)} toplam</div>
            <button class="buton tehlike" data-masa-sil="${masa.id}">Sil</button>
          </article>
        `).join("")}
      </div>
    </section>
  `);

  document.querySelector("#adminCikis").addEventListener("click", () => {
    durum.adminSifresi = "";
    localStorage.removeItem("adminSifresi");
    ekraniCiz();
  });

  document.querySelector("#urunEkleFormu").addEventListener("submit", urunEkle);
  document.querySelector("#masaEkleFormu").addEventListener("submit", masaEkle);

  document.querySelectorAll("[data-urun-ad]").forEach((girdi) => {
    girdi.addEventListener("change", () => urunGuncelle(girdi.dataset.urunAd, { ad: girdi.value }));
  });

  document.querySelectorAll("[data-urun-kategori]").forEach((girdi) => {
    girdi.addEventListener("change", () => urunGuncelle(girdi.dataset.urunKategori, { kategori: girdi.value }));
  });

  document.querySelectorAll("[data-urun-fiyat]").forEach((girdi) => {
    girdi.addEventListener("change", () => urunGuncelle(girdi.dataset.urunFiyat, { fiyat: Number(girdi.value) }));
  });

  document.querySelectorAll("[data-urun-gorsel]").forEach((girdi) => {
    girdi.addEventListener("change", () => urunGuncelle(girdi.dataset.urunGorsel, { gorsel: girdi.value }));
  });

  document.querySelectorAll("[data-urun-gorsel-dosyasi]").forEach((girdi) => {
    girdi.addEventListener("change", async () => {
      const yuklenenGorsel = await dosyayiGorseleCevir(girdi.files[0]);
      await urunGuncelle(girdi.dataset.urunGorselDosyasi, { gorsel: yuklenenGorsel });
    });
  });

  document.querySelectorAll("[data-urun-aktif]").forEach((buton) => {
    buton.addEventListener("click", () => {
      const [urunId, aktif] = buton.dataset.urunAktif.split(":");
      urunGuncelle(urunId, { aktif: aktif === "true" });
    });
  });

  document.querySelectorAll("[data-masa-ad]").forEach((girdi) => {
    girdi.addEventListener("change", () => masaGuncelle(girdi.dataset.masaAd, { ad: girdi.value }));
  });

  document.querySelectorAll("[data-masa-sil]").forEach((buton) => {
    buton.addEventListener("click", () => masaSil(buton.dataset.masaSil).catch((hata) => alert(hata.message)));
  });
}

// Her masa için ayrı QR kod sayfasını çizer.
function qrEkraniCiz() {
  iskeletiCiz(`
    <section class="panel">
      <div class="bolum-basligi">
        <div>
          <h2>QR Masalar</h2>
          <p>Her masanın linki ayrıdır; QR kodu yazdırıp masaya koyabilirsiniz.</p>
        </div>
      </div>
      <div class="qr-uyari">
        <strong>Telefonla okutmak için</strong>
        <span>Telefon ve kasa bilgisayarı aynı Wi-Fi ağında olmalı. QR adresleri şu ağ adresiyle hazırlanıyor: ${durum.veri.sunucuAdresi || location.origin}</span>
      </div>
      <div class="qr-izgarasi">
        ${durum.veri.masalar.map((masa) => `
          <article class="qr-karti">
            <div class="qr-kutu">
              <img src="${qrGorseli(masa.id)}" alt="${masa.ad} QR kodu" />
            </div>
            <strong>${masa.ad}</strong>
            <p class="yardimci-yazi">${masaLinki(masa.id)}</p>
            <a class="buton tam" href="${masaLinki(masa.id)}">Menüyü Aç</a>
          </article>
        `).join("")}
      </div>
    </section>
  `);
}

// Geçerli ekrana göre doğru çizim fonksiyonunu çağırır.
function ekraniCiz() {
  if (durum.ekran === "cashier") return kasaEkraniCiz();
  if (durum.ekran === "admin") return adminEkraniCiz();
  if (durum.ekran === "qr") return qrEkraniCiz();
  return menuEkraniCiz();
}

// Uygulama ilk açıldığında sunucudan verileri alır ve canlı güncellemeyi başlatır.
async function baslat() {
  const cevap = await fetch("/api/durum");
  durum.veri = await cevap.json();
  durum.kasaMasaId = durum.veri.masalar[0]?.id || "1";
  ekraniCiz();

  // Server-Sent Events ile kasa/admin ekranı sayfa yenilemeden güncellenir.
  const canli = new EventSource("/api/canli");
  canli.onmessage = (olay) => {
    durum.veri = JSON.parse(olay.data);
    ekraniCiz();
  };
}

// Başlatma sırasında hata olursa kullanıcıya açık bir mesaj gösterir.
baslat().catch((hata) => {
  uygulama.innerHTML = `<main class="ana-alan"><section class="panel">${hata.message}</section></main>`;
});
