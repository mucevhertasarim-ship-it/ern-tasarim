# ERN Tasarim - Vercel Yayina Alma (Deploy) Rehberi

Bu rehber, ERN Tasarim web sitesini ve canli yonetim panelini Vercel uzerinde 0 TL maliyetle, yuksek hizda (Global Edge CDN) ve ucretsiz SSL sertifikasiyla yayina almaniz icin adim adim hazirlanmistir.

---

## Neler Hazirlandi?

1. vercel.json: Vercel sunucusuz yonlendirme kurallari, 3D GLB modelleri icin ozel MIME tipi (model/gltf-binary) ve CORS basliklari eklendi.
2. api/index.py: Vercel Serverless Python altyapisi (Flask & IMAP/SMTP mail API'si) baglandi.
3. requirements.txt: Vercel'in kuracagi Python kutuphaneleri (flask, werkzeug) tanimlandi.
4. .gitignore: Gizli sifrelerin ve gereksiz dosyalarin depoya yuklenmesi engellendi.
5. Dosya Boyutu Optimizasyonu: Sitede aktif kullanilmayan 62 adet ham dokum STL dosyasi (1 GB), masaustundeki 'ham_stl_arsiv' klasorune guvenle arsivlendi. Sitedeki hicbir dosya 22 MB'i gecmeyecek sekilde ayarlandi (GitHub 25 MB web upload limitine tam uyumlu).

---

## ADIM 1: Dosyalari GitHub'a Yukleme

1. https://github.com adresine git ve hesabina giris yap.
2. Sag ustteki '+' ikonuna tiklayip 'New repository' (Yeni Depo) sec.
3. Repository name kismina 'ern-tasarim' yaz.
4. Public veya Private secip en alttan yesil 'Create repository' butonuna bas.
5. Acilan sayfada 'uploading an existing file' baglantisina tikla.
6. Masaustundeki 'ern site' klasorunun icindeki tum dosyalari secip tarayiciya surukle birak.
7. Sayfanin altindaki yesil 'Commit changes' butonuna bas.

---

## ADIM 2: Vercel ile Projeyi Yayina Alma

1. https://vercel.com adresine git ve GitHub hesabinla giris yap.
2. Vercel kontrol panelinde sag ustteki 'Add New...' -> 'Project' secenegine tikla.
3. Karsina cikan listeden az once actigin 'ern-tasarim' deposunu bulup yanindaki 'Import' butonuna bas.
4. Kurulum ayarlari ekraninda:
   - Framework Preset: Other kalsin.
   - Root Directory: ./ kalsin.
   - (Istege Bagli) Environment Variables (Ortam Degiskenleri) kismini genisleterek e-posta ayarlarini tanimlayabilirsin:
     - IMAP_HOST = mail.erntasarim.com
     - SMTP_HOST = mail.erntasarim.com
     - MAIL_USER = info@erntasarim.com
     - MAIL_PASS = e-posta sifren
5. En alttaki mavi 'Deploy' butonuna bas!
6. Yaklasik 1 dakika icinde tebrik ekrani (konfeti) cikacak ve sana 'https://ern-tasarim.vercel.app' seklinde aninda calisan bir canli site linki verecektir!

---

## ADIM 3: Kendi Alan Adini (Domain) Baglama (Orn: erntasarim.com)

1. Vercel'de projenin sayfasina gir -> Ust menuden Settings -> Domains sekmesine tikla.
2. Kutucuga kendi alan adini yaz (Orn: erntasarim.com) ve Add de.
3. Vercel sana girmen gereken DNS kayitlarini gosterecektir:
   - A Kaydi (@ icin): 76.76.21.21
   - CNAME Kaydi (www icin): cname.vercel-dns.com
4. Alan adini aldigin yere (cPanel Zone Editor, Natro, Turhost, Isimtescil veya Cloudflare) girip bu 2 kaydi ekle/guncelle.
5. (Not: MX ve mail. CNAME kayitlarina dokunma, e-postalarin kesintisiz calismaya devam etsin).

Kayitlari girdikten birkac dakika sonra siten kendi alan adinla Vercel uzerinden dunyanin her yerinde roket hizinda acilacaktir!
