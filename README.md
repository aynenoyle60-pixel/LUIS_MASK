# Kafe QR Siparis Uygulamasi

Bu klasorde QR menulu, masa bazli siparis ve kasa takip sistemi icin web uygulamasi yer alacak.

On izleme icin:

```powershell
npm start
```

Sonra tarayicida:

- Musteri menusu: http://localhost:3000/?view=menu&table=1
- Kasa ekrani: http://localhost:3000/?view=cashier
- Admin paneli: http://localhost:3000/?view=admin
- QR masalar: http://localhost:3000/?view=qr

Admin panelinde ürün eklerken veya düzenlerken görsel dosyası yükleyebilirsiniz. İsterseniz `Görsel URL yedeği` alanına internetten aldığınız bir görsel bağlantısı da yazabilirsiniz.

Başlangıçtaki ürün ve Luis Mask vitrin görselleri Unsplash kaynaklı gerçek fotoğraf bağlantılarıdır. İnternet yoksa bu fotoğraflar görünmeyebilir; kalıcı kullanım için admin panelinden kendi çektiğiniz ürün fotoğraflarını yüklemeniz önerilir.

Kasa ekranında ödeme alırken `Ödenecek ürünler` bölümünden ürünleri seçerseniz tutar otomatik hesaplanır ve ödeme kaydına hangi ürünlerin ödendiği yazılır.

Ödeme ekranı gerçek banka tahsilatı yapmaz; tahsilat kaydı tutar. Kredi kartı, banka QR, yemek kartı veya online ödeme almak için banka/POS firması ya da ödeme kuruluşuyla ayrıca anlaşma gerekir.

## Kafede kurulum mantığı

Bu uygulama bir bilgisayarda sunucu olarak çalışır. Kasa bilgisayarı ana bilgisayar olabilir.

1. Ana bilgisayara Node.js kurulur.
2. Bu klasör ana bilgisayara kopyalanır.
3. Klasörde terminal açılır ve `npm start` çalıştırılır.
4. Aynı bilgisayardan kasa ekranı açılır: `http://localhost:3000/?view=cashier`
5. Diğer cihazlar aynı Wi-Fi ağındaysa ana bilgisayarın yerel IP adresiyle bağlanır.

Örnek: ana bilgisayar IP adresi `192.168.1.25` ise:

- Müşteri menüsü: `http://192.168.1.25:3000/?view=menu&table=1`
- Kasa ekranı: `http://192.168.1.25:3000/?view=cashier`
- Admin paneli: `http://192.168.1.25:3000/?view=admin`
- QR masalar: `http://192.168.1.25:3000/?view=qr`

## Masa ve QR yönetimi

Admin panelindeki `Masa Yönetimi` bölümünden masa ekleyebilir, masa adını değiştirebilir veya boş masayı silebilirsiniz.

Masa eklenince QR ekranında otomatik yeni QR oluşur. Masa silinirse o masanın QR'ı listeden kalkar.

Dolu masa silinmez. Sipariş veya ödeme varsa önce kasa ekranından `Masayı Kapat` yapılmalıdır.

## Sonradan değişiklik istemek

Arayüz, menü, fiyat, kategori, ödeme veya rapor gibi yenilikler için bu klasörü tekrar açıp Codex'e ne istediğinizi yazabilirsiniz. Örneğin:

- `Admin paneline gün sonu raporu ekle`
- `Müşteri ekranını daha lüks yap`
- `Masalara garson çağır butonu ekle`
- `Ödeme kayıtlarını tarih filtresiyle göster`
