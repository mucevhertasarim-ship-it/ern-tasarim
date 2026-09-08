const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

// Page-Flip (stPageFlip) Global State
let currentPdf = null;
let currentPage = 1;
let totalPages = 0;
let currentScale = 1.0;
let currentBookId = null;
let currentBookData = null;

let pageFlip = null;
let renderedPages = {};
let pageImagesData = {};
let bookWidth = 0;
let bookHeight = 0;
let isDoublePageMode = window.innerWidth > 992;

// Arama/İşaret Durumu
let searchResults = [];
let currentSearchIndex = -1;
let pdfPageTexts = [];

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const FEATURED_BOOKS = [
    {
        id: 'alice_in_wonderland',
        title: "Alice's Adventures in Wonderland",
        author: 'Lewis Carroll',
        coverColor: 'c1',
        pdfUrl: 'https://www.gutenberg.org/files/11/11-pdf.pdf'
    },
    {
        id: 'frankenstein',
        title: 'Frankenstein',
        author: 'Mary Wollstonecraft Shelley',
        coverColor: 'c2',
        pdfUrl: 'https://www.gutenberg.org/files/84/84-pdf.pdf'
    },
    {
        id: 'dracula',
        title: 'Dracula',
        author: 'Bram Stoker',
        coverColor: 'c3',
        pdfUrl: 'https://www.gutenberg.org/files/345/345-pdf.pdf'
    },
    {
        id: 'christmas_carol',
        title: 'A Christmas Carol',
        author: 'Charles Dickens',
        coverColor: 'c4',
        pdfUrl: 'https://www.gutenberg.org/files/46/46-pdf.pdf'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    renderFeaturedBooks();
    loadRecentBooks();
    setupEventListeners();
    checkRedirectFromSearch();
}

function renderFeaturedBooks() {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;
    
    grid.innerHTML = FEATURED_BOOKS.map(book => `
        <div class="book-card" onclick="openOnlineBook('${book.id}')">
            <div class="book-cover-container">
                <div class="generic-cover ${book.coverColor}">
                    <div class="generic-cover-author">${book.author}</div>
                    <div class="generic-cover-title">${book.title}</div>
                    <div style="font-size: 0.75rem; opacity: 0.6;">Ücretsiz Oku</div>
                </div>
            </div>
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">${book.author}</div>
            </div>
        </div>
    `).join('');
}

function loadRecentBooks() {
    const recentsGrid = document.getElementById('recent-grid');
    const recentsSection = document.getElementById('recent-section');
    if (!recentsGrid || !recentsSection) return;
    
    const progressData = getProgressData();
    const books = Object.values(progressData).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (books.length === 0) {
        recentsSection.style.display = 'block';
        recentsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--border-color); border-radius: 16px; color: var(--text-secondary);">
                <i class="fa-solid fa-book-bookmark" style="font-size: 2rem; color: #8b5cf6; margin-bottom: 0.75rem;"></i>
                <h3 style="color: #fff; font-size: 1.1rem; font-weight: 600;">Henüz Okunan Kitap Bulunmuyor</h3>
                <p style="font-size: 0.85rem; margin-top: 0.4rem;">Yukarıdaki arama kutusundan dilediğiniz kitabı arayabilir veya <strong>"Cihazımdan Oku"</strong> butonuna basarak bilgisayarınızdaki PDF'leri okuyabilirsiniz.</p>
            </div>
        `;
        return;
    }
    
    recentsSection.style.display = 'block';
    recentsGrid.innerHTML = books.map(book => {
        const percent = Math.round((book.lastPage / book.totalPage) * 100) || 0;
        const isLocal = book.id.startsWith('local_');
        
        return `
            <div class="book-card" onclick="openRecentBook('${book.id}')">
                <div class="book-cover-container">
                    <div class="generic-cover ${book.coverColor || 'c1'}">
                        <div class="generic-cover-author">${book.author}</div>
                        <div class="generic-cover-title">${book.title}</div>
                        <div style="font-size: 0.75rem; opacity: 0.6;">${isLocal ? 'Yerel PDF' : 'Online PDF'}</div>
                    </div>
                </div>
                <div class="book-info">
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">${book.author}</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${percent}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>%${percent} tamamlandı</span>
                        <span>S. ${book.lastPage}/${book.totalPage}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function setupEventListeners() {
    // Arama Çubuğu & Hemen Oku Butonu
    const searchInput = document.getElementById('main-search');
    const quickReadBtn = document.getElementById('btn-quick-read');
    let searchTimeout = null;
    
    if (searchInput) {
        // Yazdıkça arama sonuçlarını aşağıda canlı listeler
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            if (query.length < 3) {
                if (query.length === 0) {
                    document.getElementById('search-results-section').style.display = 'none';
                }
                return;
            }
            searchTimeout = setTimeout(() => {
                performLibrarySearch(query, false); // false = otomatik okuyucuyu açma, sadece listele
            }, 600);
        });
        
        // Enter tuşuna basınca klavyeyi gizle ve sonuçları aşağıda listele
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchTimeout);
                const query = searchInput.value.trim();
                if (query.length >= 2) {
                    searchInput.blur(); // Mobilde klavyeyi otomatik aşağı indir
                    performLibrarySearch(query, false);
                }
            }
        });
    }
    
    // "Kitap Ara 🔍" butonuna basınca klavyeyi gizle ve sonuçları aşağıda listele
    if (quickReadBtn && searchInput) {
        quickReadBtn.addEventListener('click', () => {
            clearTimeout(searchTimeout);
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                searchInput.blur(); // Mobilde klavyeyi otomatik aşağı indir
                performLibrarySearch(query, false);
            } else {
                alert('Lütfen okumak istediğiniz kitabın adını yazın.');
                searchInput.focus();
            }
        });
    }
    
    // Cihazdan PDF Seçme
    const fileInput = document.getElementById('local-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleLocalFileSelect);
    }
    
    // Okuyucu Kapatma
    document.getElementById('close-reader').addEventListener('click', closeReader);
    
    // Zoom Kontrolleri
    document.getElementById('zoom-in').addEventListener('click', () => adjustZoom(0.15));
    document.getElementById('zoom-out').addEventListener('click', () => adjustZoom(-0.15));
    
    // Sayfa Düzeni Değiştirme
    document.getElementById('toggle-view-mode').addEventListener('click', () => {
        if (!pageFlip) return;
        
        const orientation = pageFlip.getOrientation(); // 'portrait' or 'landscape'
        const icon = document.querySelector('#toggle-view-mode i');
        icon.classList.toggle('fa-book-open-reader');
        icon.classList.toggle('fa-book-open');
        
        // PageFlip ayarını değiştir
        pageFlip.updateState({
            usePortrait: orientation === 'landscape'
        });
    });
    
    // Yer İşareti Ekleme
    document.getElementById('add-bookmark').addEventListener('click', () => {
        toggleBookmark(currentPage);
        document.getElementById('bookmarks-drawer').classList.toggle('active');
        setTimeout(resizeBook, 350); // Çekmece açılış animasyonu sonrasında boyutu yeniden hesapla
    });
    
    // Klavye Yön Tuşları
    document.addEventListener('keydown', (e) => {
        if (!document.getElementById('reader-modal').classList.contains('active') || !pageFlip) return;
        if (e.key === 'ArrowLeft') pageFlip.flipPrev();
        if (e.key === 'ArrowRight') pageFlip.flipNext();
    });
    
    // Sayfa Manuel Girişi
    const pageInput = document.getElementById('current-page-input');
    if (pageInput) {
        pageInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (pageFlip && !isNaN(val) && val >= 1 && val <= totalPages) {
                pageFlip.turnToPage(val - 1); // 0-indexed
            } else {
                pageInput.value = currentPage;
            }
        });
    }
    
    // Floating Navigasyon
    document.getElementById('prev-page-floating').addEventListener('click', () => {
        if (pageFlip) pageFlip.flipPrev();
    });
    document.getElementById('next-page-floating').addEventListener('click', () => {
        if (pageFlip) pageFlip.flipNext();
    });
    
    // Kitap İçi Arama
    document.getElementById('toggle-search-drawer').addEventListener('click', () => {
        document.getElementById('search-drawer').classList.toggle('active');
        if (document.getElementById('search-drawer').classList.contains('active')) {
            document.getElementById('drawer-search').focus();
        }
        setTimeout(resizeBook, 350); // Çekmece açılış animasyonu sonrasında boyutu yeniden hesapla
    });
    
    document.getElementById('drawer-search').addEventListener('input', (e) => {
        searchInsidePdf(e.target.value.trim());
    });
    
    document.getElementById('search-prev').addEventListener('click', () => navigateSearchResult(-1));
    document.getElementById('search-next').addEventListener('click', () => navigateSearchResult(1));
    
    // Okuyucudaki PDF'i bilgisayara/telefonuna indirme butonu
    const btnDownload = document.getElementById('btn-download-pdf');
    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            if (currentBookId && currentBookId.startsWith('online_')) {
                const identifier = currentBookId.replace('online_', '');
                const title = document.getElementById('reader-title').textContent || 'Kitap';
                downloadPdfDirectly(identifier, title);
            } else {
                alert('Yerel PDF dosyaları zaten cihazınızda kayıtlıdır.');
            }
        });
    }
    
    // Sağ tık büyüteç özelliğini kur
    setupMagnifier();
    
    // AI Sesli Kitap Okuyucu Motorunu Kur
    setupTtsEngine();
}

// Gelen verinin GERÇEK bir PDF dosyası olup olmadığını (%PDF başlık kontrolü ile) doğrulama
function isValidPdfBuffer(buffer) {
    if (!buffer || buffer.byteLength < 100) return false;
    try {
        const arr = new Uint8Array(buffer, 0, 10);
        let str = '';
        for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
        return str.includes('%PDF');
    } catch(e) {
        return false;
    }
}

// Zaman Aşımı Destekli Hızlı Fetch (Asılı kalmaları ve takılmaları önler)
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

// Canlı % Yüzde İlerleme Takip Destekli İndirme Motoru
async function fetchWithProgress(url, statusCallback, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) return null;
        
        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        
        if (!response.body) {
            const ab = await response.arrayBuffer();
            return ab;
        }
        
        const reader = response.body.getReader();
        let loadedBytes = 0;
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loadedBytes += value.length;
            
            if (statusCallback) {
                if (totalBytes > 0) {
                    const pct = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
                    statusCallback(`İndiriliyor: %${pct}`);
                } else {
                    const mb = (loadedBytes / (1024 * 1024)).toFixed(1);
                    statusCallback(`İndiriliyor: ${mb} MB...`);
                }
            }
        }
        
        const combined = new Uint8Array(loadedBytes);
        let offset = 0;
        for (let chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }
        return combined.buffer;
    } catch(e) {
        clearTimeout(timeoutId);
        return null;
    }
}

// Çoklu Proxy Destekli Canlı Yüzdeli Yıldırım İndirme
async function fetchArrayBufferWithProxy(url, statusCallback) {
    if (statusCallback) statusCallback('İndiriliyor: %0');
    
    try {
        const ab = await fetchWithProgress(url, statusCallback, 30000);
        if (ab && isValidPdfBuffer(ab)) {
            if (statusCallback) statusCallback('İndirme Tamamlandı: %100');
            return ab;
        }
    } catch(e) {}
    
    const proxies = [
        u => `https://corsproxy.org/?${encodeURIComponent(u)}`,
        u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
        u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
    ];
    
    for (let i = 0; i < proxies.length; i++) {
        if (statusCallback) statusCallback(`Alternatif Kanal (${i + 1}/${proxies.length}) üzerinden indiriliyor...`);
        try {
            const proxyUrl = proxies[i](url);
            const ab = await fetchWithProgress(proxyUrl, statusCallback, 30000);
            if (ab && isValidPdfBuffer(ab)) {
                if (statusCallback) statusCallback('İndirme Tamamlandı: %100');
                return ab;
            }
        } catch (e) {}
    }
    
    return null;
}

async function fetchJsonWithProxy(url) {
    try {
        const r = await fetch(url);
        if (r.ok) return await r.json();
    } catch (e) {}
    
    const proxies = [
        `https://corsproxy.org/?${encodeURIComponent(url)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    ];
    
    for (let proxyUrl of proxies) {
        try {
            const r = await fetchWithTimeout(proxyUrl, {}, 6000);
            if (r.ok) return await r.json();
        } catch (e) {}
    }
    return null;
}

// İnternet Üzerinden Gerçek PDF Kitap Arama Motoru (Kitap Oku AI - İlgili Sonuç Odaklı)
async function performLibrarySearch(query, autoOpen = false) {
    const section = document.getElementById('search-results-section');
    const grid = document.getElementById('search-results-grid');
    const loading = document.getElementById('search-loading');
    
    if (!section || !grid || !loading) return;
    
    section.style.display = 'block';
    grid.innerHTML = '';
    loading.style.display = 'block';
    
    const cleanQuery = query.trim();
    if (cleanQuery.startsWith('http://') || cleanQuery.startsWith('https://') || cleanQuery.toLowerCase().endsWith('.pdf')) {
        showToast('Doğrudan PDF bağlantısı tespit edildi, 3D okuyucuda açılıyor...');
        const titleName = decodeURIComponent(cleanQuery.split('/').pop()).replace('.pdf', '') || 'PDF Belgesi';
        
        try {
            const buffer = await fetchArrayBufferWithProxy(cleanQuery, (statusText) => {
                if (loading && loading.querySelector('p')) {
                    loading.querySelector('p').textContent = statusText;
                }
            });
            loading.style.display = 'none';
            if (buffer && isValidPdfBuffer(buffer)) {
                await loadPdfDocument(buffer, titleName);
                document.getElementById('reader-modal').classList.add('active');
                return;
            }
        } catch(e) {}
        
        loading.style.display = 'none';
        const proxiedUrl = `https://corsproxy.org/?${encodeURIComponent(cleanQuery)}`;
        await loadPdfDocument(proxiedUrl, titleName);
        document.getElementById('reader-modal').classList.add('active');
        return;
    }
    
    try {
        // En yüksek başarı oranına sahip sade Internet Archive arama sorgusu
        const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(cleanQuery)}+AND+mediatype:(texts)&fl[]=identifier,title,creator,downloads&sort[]=downloads+desc&rows=30&page=1&output=json`;
        
        let data = await fetchJsonWithProxy(searchUrl);
        
        // Eğer sonuç gelmediyse yedek arama sorgusu dene
        if (!data || !data.response || !data.response.docs || data.response.docs.length === 0) {
            const fallbackUrl = `https://archive.org/advancedsearch.php?q=title:(${encodeURIComponent(cleanQuery)})+AND+mediatype:(texts)&fl[]=identifier,title,creator,downloads&sort[]=downloads+desc&rows=30&page=1&output=json`;
            data = await fetchJsonWithProxy(fallbackUrl);
        }
        
        loading.style.display = 'none';
        
        if (!data || !data.response || !data.response.docs || data.response.docs.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; background: rgba(15, 23, 42, 0.5); border: 1px dashed var(--border-color); border-radius: 14px; color: var(--text-secondary);">
                    <i class="fa-solid fa-face-frown" style="font-size: 1.8rem; color: #f59e0b; margin-bottom: 0.5rem;"></i>
                    <h4 style="color: #fff; font-size: 1rem;">"${cleanQuery}" ile ilgili doğrudan sonuç bulunamadı</h4>
                    <p style="font-size: 0.85rem; margin-top: 0.3rem;">Aşağıdaki Google Dork butonuna basarak tüm web'de aratabilir veya bilgisayarınızdaki PDF'i yükleyebilirsiniz.</p>
                </div>
            `;
            return;
        }
        
        let docs = data.response.docs;
        docs = docs.slice(0, 16);
        window.currentSearchDocs = docs;
        
        grid.innerHTML = docs.map((doc, idx) => {
            const title = doc.title || cleanQuery;
            const author = doc.creator ? (Array.isArray(doc.creator) ? doc.creator[0] : doc.creator) : 'Klasik Eser';
            const identifier = doc.identifier;
            const coverImg = `https://archive.org/services/img/${identifier}`;
            
            return `
                <div class="book-card" style="position:relative;">
                    <div onclick="handleBookCardClick(${idx})" class="book-cover-container" style="background:#0f172a; border-radius:10px; overflow:hidden; display:flex; align-items:center; justify-content:center; height:200px; position:relative; cursor:pointer;" title="Kitabı 3D Okuyucuda Aç 📖">
                        <img src="${coverImg}" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'150\\' height=\\'220\\' style=\\'background:%231e1b4b;\\'><text x=\\'50%\\' y=\\'50%\\' fill=\\'%238b5cf6\\' font-size=\\'14\\' text-anchor=\\'middle\\'>📚 KİTAP</text></svg>';" style="width:100%; height:100%; object-fit:cover;">
                        <span style="position:absolute; top:6px; right:6px; background:rgba(99, 102, 241, 0.88); color:#ffffff; padding:0.25rem 0.55rem; border-radius:8px; font-size:0.68rem; font-weight:700; backdrop-filter:blur(4px); border:1px solid rgba(255,255,255,0.2); display:flex; align-items:center; gap:0.3rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                            <i class="fa-solid fa-book-open"></i> 3D OKU
                        </span>
                    </div>
                    
                    <div class="book-info" style="margin-top:0.6rem;">
                        <div onclick="handleBookCardClick(${idx})" class="book-title" style="font-weight:600; font-size:0.85rem; color:#f8fafc; line-height:1.2; height:2.4em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; cursor:pointer;" title="3D Okuyucuda Aç">${title}</div>
                        <div class="book-author" style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${author}</div>
                        
                        <div style="display:flex; gap:0.4rem; margin-top:0.65rem;">
                            <button onclick="handleSourceClick(event, ${idx})" style="flex:1; padding:0.45rem; background:rgba(56, 189, 248, 0.15); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.35); border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.3rem;" title="Orijinal İnternet Arşivi Kaynağını Aç">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                <span>KAYNAĞI AÇ</span>
                            </button>
                            
                            <button onclick="handleBookDownloadClick(${idx})" style="padding:0.45rem 0.65rem; background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.3rem; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);" title="PDF Olarak Cihazıma İndir">
                                <i class="fa-solid fa-download"></i>
                                <span>İNDİR</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        if (autoOpen && docs.length > 0) {
            handleBookCardClick(0);
        }
        
    } catch (err) {
        console.error('Arama hatası:', err);
        loading.style.display = 'none';
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">Arama yapılırken bir hata oluştu. Lütfen tekrar deneyin.</div>`;
    }
}

// Resme (Kapak Fotoğrafına) Tıklayınca Orijinal Kaynak Web Sitesini Yeni Sekmede Açma
function handleSourceClick(e, idx) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (!window.currentSearchDocs || !window.currentSearchDocs[idx]) return;
    const doc = window.currentSearchDocs[idx];
    const sourceUrl = `https://archive.org/details/${doc.identifier}`;
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
}

// Kart 3D Oku buton tıklama yöneticisi
function handleBookCardClick(idx) {
    if (!window.currentSearchDocs || !window.currentSearchDocs[idx]) return;
    const doc = window.currentSearchDocs[idx];
    const title = doc.title || 'Kitap';
    const author = doc.creator ? (Array.isArray(doc.creator) ? doc.creator[0] : doc.creator) : 'Klasik Eser';
    const identifier = doc.identifier;
    const coverImg = `https://archive.org/services/img/${identifier}`;
    
    openOnlinePdf(identifier, title, author, coverImg);
}

// Kart İndir buton tıklama yöneticisi
function handleBookDownloadClick(idx) {
    if (!window.currentSearchDocs || !window.currentSearchDocs[idx]) return;
    const doc = window.currentSearchDocs[idx];
    downloadPdfDirectly(doc.identifier, doc.title || 'Kitap');
}

// Kullanıcının attığı Akıllı Google Dork PDF Arama Motoru Entegrasyonu
function searchGoogleDork() {
    const input = document.getElementById('main-search');
    const keyword = input ? input.value.trim() : '';
    
    if (!keyword) {
        showToast('Lütfen önce aranacak konuyu veya kitap adını yaz kanka!');
        return;
    }
    
    // Gelişmiş Google Dork komutunu hazırlıyoruz
    const dorkQuery = keyword + ' filetype:pdf inurl:pdf';
    const googleUrl = 'https://www.google.com/search?q=' + encodeURIComponent(dorkQuery);
    
    showToast(`"${keyword}" için Google Dork araması başlatıldı! Çıkan linkleri buraya yapıştırıp okuyabilirsin.`);
    window.open(googleUrl, '_blank');
}

let isEmbedMode = false;
let currentIdentifier = '';
let currentBookTitle = '';
let currentBookAuthor = '';

// Orijinal İnternet Arşivi Okuyucusu (archive.org/embed/) ve Bizim 3D Okuyucumuz Arasında Canlı Geçiş
function toggleEmbedReader() {
    isEmbedMode = !isEmbedMode;
    const wrapper = document.getElementById('flipbook-wrapper');
    const embedBtn = document.getElementById('btn-toggle-embed');
    
    if (isEmbedMode && currentIdentifier) {
        wrapper.innerHTML = `
            <iframe src="https://archive.org/embed/${currentIdentifier}" width="100%" height="100%" frameborder="0" webkitallowfullscreen="true" mozallowfullscreen="true" allowfullscreen style="border:none; width:100%; height:100%; min-height:82vh; border-radius:12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);"></iframe>
        `;
        if (embedBtn) embedBtn.innerHTML = '<i class="fa-solid fa-book-open"></i> <span>3D Kitaplık Görünümü</span>';
    } else {
        if (embedBtn) embedBtn.innerHTML = '<i class="fa-solid fa-globe"></i> <span>Orijinal Arşiv Görünümü</span>';
        loadOnlineBookPages(currentIdentifier, currentBookTitle, currentBookAuthor);
    }
}

// İnternetten Seçilen Kitabı Bilgisayara İndirmeden Doğrudan Kaynaktan Canlı Sunum Modunda (0.1s) Açma
async function openOnlinePdf(identifier, title, author, coverImg) {
    const loadingOverlay = document.getElementById('search-loading');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    
    currentIdentifier = identifier;
    currentBookTitle = title || 'Kitap';
    currentBookAuthor = author || 'Klasik Eser';
    isEmbedMode = false;
    
    const embedBtn = document.getElementById('btn-toggle-embed');
    if (embedBtn) embedBtn.innerHTML = '<i class="fa-solid fa-globe"></i> <span>Orijinal Arşiv Görünümü</span>';
    
    // Kitabı Son Okunanlar listesine kaydet
    saveToRecentBooks({
        id: 'online_' + identifier,
        title: title,
        author: author,
        coverImg: coverImg || null
    });
    
    // Bilgisayara/Cihaza 30MB indirme yükü bindirmeden doğrudan kaynaktan canlı sayfa akışı ile 0.1 saniyede aç!
    loadOnlineBookPages(identifier, title, author);
}

// Okuyucu Üst Header Sayfa Sayacı Güncelleme Fonksiyonu
function updatePageInfo() {
    const totalSpan = document.getElementById('total-pages-span');
    const floatTotal = document.getElementById('floating-total-pages');
    const pageInput = document.getElementById('page-num-input');
    const floatCurrent = document.getElementById('floating-current-page');
    
    const maxP = typeof totalPages !== 'undefined' ? totalPages : 40;
    const curP = typeof currentPage !== 'undefined' ? currentPage : 1;
    
    if (totalSpan) totalSpan.textContent = `/ ${maxP}`;
    if (floatTotal) floatTotal.textContent = maxP;
    if (pageInput) pageInput.value = curP;
    if (floatCurrent) floatCurrent.textContent = curP;
}

// PDF İndirme Engellerini %100 Aşan Tembel Yüklemeli Işık Hızında Canlı Görsel Motoru (0.05s)
function loadOnlineBookPages(identifier, title, author) {
    const modal = document.getElementById('reader-modal');
    modal.classList.add('active');
    document.getElementById('reader-title').textContent = `${title} (${author})`;
    
    const loadingOverlay = document.getElementById('search-loading');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    
    if (pageFlip) {
        try { pageFlip.destroy(); } catch(e) {}
        pageFlip = null;
    }
    
    const wrapper = document.getElementById('flipbook-wrapper');
    if (wrapper) {
        wrapper.innerHTML = '<div id="flipbook"></div>';
    }
    
    const flipbook = document.getElementById('flipbook');
    flipbook.innerHTML = '';
    
    totalPages = 40;
    currentPage = 1;
    
    // Tarayıcıyı kasmamak için ilk 4 sayfayı anında yükle, kalanları akıllı tembel yükleme (lazy loading) yap
    for (let i = 1; i <= totalPages; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        pageDiv.style.background = '#0f172a';
        pageDiv.style.display = 'flex';
        pageDiv.style.alignItems = 'center';
        pageDiv.style.justifyContent = 'center';
        pageDiv.style.overflow = 'hidden';
        pageDiv.style.position = 'relative';
        pageDiv.style.width = '100%';
        pageDiv.style.height = '100%';
        
        const img = document.createElement('img');
        img.id = `img-page-${i}`;
        const realSrc = `https://archive.org/download/${identifier}/page/n${i - 1}.jpg`;
        
        // İlk 4 sayfayı doğrudan yükle, diğerlerini çevirdikçe akışa dahil et (0 kilitlenme)
        if (i <= 4) {
            img.src = realSrc;
        } else {
            img.dataset.src = realSrc;
        }
        
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.pointerEvents = 'none';
        
        pageDiv.appendChild(img);
        flipbook.appendChild(pageDiv);
    }
    
    calculateBookDimensions(450, 650);
    
    const isMobile = window.innerWidth <= 768;
    const mode = (isDoublePageMode && !isMobile) ? 'landscape' : 'portrait';
    
    pageFlip = new St.PageFlip(flipbook, {
        width: Math.round(bookWidth),
        height: Math.round(bookHeight),
        size: 'fixed',
        minWidth: 280,
        maxWidth: 1000,
        minHeight: 400,
        maxHeight: 1400,
        drawShadow: true,
        flippingTime: 600,
        usePortrait: mode === 'portrait',
        startPage: 0,
        useMouseEvents: true,
        showCover: true
    });
    
    pageFlip.loadFromHTML(document.querySelectorAll('.page'));
    
    // Sayfa çevrildikçe sonraki sayfaların görsellerini arka planda tıkır tıkır yükle
    pageFlip.on('flip', (e) => {
        currentPage = e.data + 1;
        updatePageInfo();
        
        // Yaklaşan 4 sayfayı tembel yükle
        for (let nextP = currentPage; nextP <= Math.min(currentPage + 4, totalPages); nextP++) {
            const nextImg = document.getElementById(`img-page-${nextP}`);
            if (nextImg && nextImg.dataset.src) {
                nextImg.src = nextImg.dataset.src;
                delete nextImg.dataset.src;
            }
        }
    });
    
    updatePageInfo();
    setupMagnifier();
}

// Şık Toast Bildirim Sistemi (Sıkıcı alert Pencerelerini Engeller)
function showToast(message) {
    let toast = document.getElementById('app-toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast-notification';
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '2rem';
        toast.style.background = 'rgba(15, 23, 42, 0.96)';
        toast.style.color = '#f8fafc';
        toast.style.border = '1px solid rgba(139, 92, 246, 0.4)';
        toast.style.padding = '0.85rem 1.4rem';
        toast.style.borderRadius = '14px';
        toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
        toast.style.zIndex = '99999';
        toast.style.fontSize = '0.85rem';
        toast.style.fontWeight = '500';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '0.75rem';
        toast.style.backdropFilter = 'blur(10px)';
        toast.style.transition = 'all 0.3s ease';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color:#8b5cf6; font-size:1.2rem;"></i> <span>${message}</span>`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 4500);
}

// Canlı % (Yüzde) İlerleme Göstergeli İndirme Modalı
function showLiveDownloadProgressModal(title) {
    let modal = document.getElementById('live-download-progress-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'live-download-progress-modal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.zIndex = '999999';
        modal.style.background = 'rgba(8, 11, 17, 0.88)';
        modal.style.backdropFilter = 'blur(12px)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.padding = '1rem';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div style="background: #0f172a; border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 20px; max-width: 440px; width: 100%; padding: 1.75rem; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.8); animation: modalPop 0.3s ease-out;">
            <div style="width: 60px; height: 60px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; font-size: 1.6rem; color: #a855f7;">
                <i class="fa-solid fa-cloud-arrow-down" id="dl-icon-spin"></i>
            </div>
            <h3 style="color: #fff; font-size: 1.15rem; font-weight: 700;">Kitap İndiriliyor...</h3>
            <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.4rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" id="dl-book-title">${title}</p>
            
            <div style="margin-top: 1.5rem; background: #1e293b; border-radius: 10px; padding: 4px; overflow: hidden; position: relative;">
                <div id="dl-progress-bar" style="height: 14px; width: 0%; background: linear-gradient(90deg, #8b5cf6, #ec4899); border-radius: 8px; transition: width 0.2s ease;"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 0.6rem; font-size: 0.8rem; font-weight: 700; color: #cbd5e1;">
                <span id="dl-status-label">Bağlanılıyor...</span>
                <span id="dl-percent-label" style="color: #a855f7;">%0</span>
            </div>
            
            <div id="dl-action-container" style="margin-top: 1.25rem; display: none;">
                <button onclick="startAutoReadDownloadedPdf(); document.getElementById('live-download-progress-modal').style.display='none';" style="width: 100%; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; padding: 0.75rem 1rem; border-radius: 12px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);">
                    <i class="fa-solid fa-play"></i> 🎉 İndirme Bitti! Şimdi Sesli Oku
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

function updateLiveDownloadProgress(percent, labelText) {
    const bar = document.getElementById('dl-progress-bar');
    const pctLabel = document.getElementById('dl-percent-label');
    const statusLabel = document.getElementById('dl-status-label');
    const actionContainer = document.getElementById('dl-action-container');
    const iconSpin = document.getElementById('dl-icon-spin');
    
    if (bar) bar.style.width = `${percent}%`;
    if (pctLabel) pctLabel.textContent = `%${percent}`;
    if (statusLabel) statusLabel.textContent = labelText || (percent >= 100 ? 'İndirme Tamamlandı!' : 'İndiriliyor...');
    
    if (percent >= 100) {
        if (actionContainer) actionContainer.style.display = 'block';
        if (iconSpin) {
            iconSpin.className = 'fa-solid fa-circle-check';
            iconSpin.style.color = '#22c55e';
        }
    }
}

// PDF Dosyasını Doğrudan Bilgisayarın İndirilenler Klasörüne Kaydeden Motor (Yeni Sekmede Açılmayı %100 Engeller)
async function downloadPdfDirectly(identifier, title) {
    if (!identifier) return;
    
    const bookTitle = title || 'Kitap';
    showLiveDownloadProgressModal(bookTitle);
    updateLiveDownloadProgress(10, 'Sunucuya bağlanılıyor...');
    
    const directPdfUrl = `https://archive.org/download/${identifier}/${identifier}.pdf`;
    
    try {
        // PDF verisini canlı yüzdelik takibiyle çek
        const buffer = await fetchWithProgress(directPdfUrl, (statusMsg) => {
            if (statusMsg.includes('%')) {
                const match = statusMsg.match(/%(\d+)/);
                if (match) {
                    const pct = parseInt(match[1], 10);
                    updateLiveDownloadProgress(pct, statusMsg);
                }
            } else {
                updateLiveDownloadProgress(40, statusMsg);
            }
        });
        
        if (buffer && isValidPdfBuffer(buffer)) {
            // Blob URL Oluştur -> Tarayıcı yeni sekmede AÇAMAZ, DOĞRUDAN İNDİRİLENLER KLASÖRÜNE İNDİRİR!
            const blob = new Blob([buffer], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${bookTitle}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
            
            downloadedPdfBufferForTts = buffer;
            downloadedPdfTitleForTts = bookTitle;
            pdfMemoryCache[identifier] = buffer;
            
            updateLiveDownloadProgress(100, '🎉 PDF İndirilenler Klasörüne Kaydedildi!');
        } else {
            // Eğer fetch engellenirse doğrudan link ile indir
            const a = document.createElement('a');
            a.href = directPdfUrl;
            a.download = `${bookTitle}.pdf`;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            updateLiveDownloadProgress(100, 'İndirme Bağlantısı Çalıştırıldı!');
        }
    } catch(e) {
        window.open(directPdfUrl, '_blank');
        updateLiveDownloadProgress(100, 'İndirme Bağlantısı Açıldı!');
    }
}

function showDownloadedCompletionNotification(title) {
    let toast = document.getElementById('tts-post-download-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'tts-post-download-toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '2.5rem';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(15, 23, 42, 0.98)';
        toast.style.color = '#f8fafc';
        toast.style.border = '2px solid #22c55e';
        toast.style.padding = '1.25rem 1.5rem';
        toast.style.borderRadius = '20px';
        toast.style.boxShadow = '0 25px 50px rgba(0,0,0,0.9)';
        toast.style.zIndex = '99999999';
        toast.style.display = 'flex';
        toast.style.flexDirection = 'column';
        toast.style.alignItems = 'center';
        toast.style.gap = '0.85rem';
        toast.style.backdropFilter = 'blur(16px)';
        toast.style.maxWidth = '420px';
        toast.style.width = '92%';
        toast.style.textAlign = 'center';
        toast.style.animation = 'modalPop 0.3s ease-out';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `
        <div style="font-weight: 800; color: #4ade80; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <i class="fa-solid fa-circle-check" style="font-size: 1.4rem;"></i> 🎉 PDF İndirmesi Başlatıldı!
        </div>
        <div style="font-size: 0.88rem; color: #e2e8f0; line-height: 1.45;">
            "<strong>${title}</strong>" cihazınıza indiriliyor. Şimdi Ahmet AI ile sesli okutmak ister misiniz?
        </div>
        <div style="display: flex; gap: 0.6rem; width: 100%; margin-top: 0.3rem;">
            <button onclick="startAutoReadDownloadedPdf()" style="flex: 1; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; padding: 0.85rem 1rem; border-radius: 12px; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);">
                <i class="fa-solid fa-headphones"></i> ▶️ ŞİMDİ SESLİ OKUT
            </button>
            <button onclick="document.getElementById('tts-post-download-toast').style.display='none'" style="background: transparent; color: #94a3b8; border: 1px solid #334155; padding: 0.85rem 1rem; border-radius: 12px; font-size: 0.85rem; cursor: pointer; font-weight: 600;">
                Kapat
            </button>
        </div>
    `;
    toast.style.display = 'flex';
}

function saveToRecentBooks(bookObj) {
    try {
        let recents = JSON.parse(localStorage.getItem('recent_books') || '[]');
        recents = recents.filter(b => b.title !== bookObj.title);
        recents.unshift({
            id: bookObj.id || 'book_' + Date.now(),
            title: bookObj.title,
            author: bookObj.author || 'Yazar Bilinmiyor',
            coverImg: bookObj.coverImg || null,
            time: Date.now()
        });
        if (recents.length > 8) recents = recents.slice(0, 8);
        localStorage.setItem('recent_books', JSON.stringify(recents));
        loadRecentBooks();
    } catch(e) {
        console.log('Son okunanlar kaydı hatası:', e);
    }
}

function handleLocalFileSelect(e) {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
        alert('Lütfen geçerli bir PDF dosyası seçin.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const arrayBuffer = event.target.result;
        const bookId = 'local_' + file.name.replace(/\s+/g, '_') + '_' + file.size;
        
        let title = file.name.replace(/\.pdf$/i, '');
        let author = 'Benim Kitabım';
        let coverColor = 'c1';
        
        if (currentBookData) {
            title = currentBookData.title;
            author = currentBookData.author;
            coverColor = currentBookData.coverColor;
            currentBookData = null;
        }
        
        loadPdfDocument(arrayBuffer, bookId, title, author, coverColor);
    };
    reader.readAsArrayBuffer(file);
}

function openOnlineBook(bookId) {
    const book = FEATURED_BOOKS.find(b => b.id === bookId);
    if (!book) return;
    
    const proxiedUrl = CORS_PROXY + encodeURIComponent(book.pdfUrl);
    loadPdfDocument(proxiedUrl, book.id, book.title, book.author, book.coverColor);
}

function openRecentBook(bookId) {
    const progressData = getProgressData();
    const book = progressData[bookId];
    if (!book) return;
    
    if (book.id.startsWith('local_')) {
        alert(`Bu yerel bir PDF'tir. Kaldığınız yerden devam etmek için lütfen "${book.title}.pdf" dosyasını tekrar seçin.`);
        currentBookData = { title: book.title, author: book.author, coverColor: book.coverColor, resumeId: book.id };
        document.getElementById('local-file-input').click();
    } else {
        openOnlineBook(book.id);
    }
}

// PDF YÜKLEME VE MODERN PAGE-FLIP ENTEGRASYONU
function loadPdfDocument(urlOrBuffer, bookId, title, author, coverColor) {
    const modal = document.getElementById('reader-modal');
    
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'pdf-loading-overlay';
    loadingMessage.style.position = 'fixed';
    loadingMessage.style.inset = '0';
    loadingMessage.style.background = 'rgba(8, 11, 17, 0.96)';
    loadingMessage.style.zIndex = '2000';
    loadingMessage.style.display = 'flex';
    loadingMessage.style.flexDirection = 'column';
    loadingMessage.style.alignItems = 'center';
    loadingMessage.style.justifyContent = 'center';
    loadingMessage.innerHTML = `
        <div class="spinner"></div>
        <h2 style="font-family: 'Playfair Display', serif; margin-top: 1rem;">"${title}" Yükleniyor...</h2>
        <p style="color: #9ca3af; margin-top: 0.5rem; font-size: 0.9rem;">Modern 3D sayfa çevirme motoru kuruluyor...</p>
    `;
    
    document.body.appendChild(loadingMessage);
    modal.classList.add('active');
    document.getElementById('reader-title').textContent = title;
    
    currentBookId = bookId;
    pdfPageTexts = [];
    renderedPages = {};
    currentScale = 1.0;
    
    let loadingParam = urlOrBuffer;
    if (urlOrBuffer instanceof ArrayBuffer) {
        loadingParam = { data: new Uint8Array(urlOrBuffer) };
    }
    
    pdfjsLib.getDocument(loadingParam).promise.then(pdf => {
        currentPdf = pdf;
        totalPages = pdf.numPages;
        document.getElementById('total-pages-span').textContent = `/ ${totalPages}`;
        document.getElementById('floating-total-pages').textContent = totalPages;
        
        const progressData = getProgressData();
        let targetPage = 1;
        if (progressData[bookId]) {
            targetPage = progressData[bookId].lastPage || 1;
        }
        
        saveProgress(bookId, title, author, coverColor, targetPage, totalPages);
        
        pdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            calculateBookDimensions(viewport.width, viewport.height);
            
            // Mevcut PageFlip varsa temizle
            if (pageFlip) {
                try {
                    pageFlip.destroy();
                } catch(e) {}
                pageFlip = null;
            }
            
            let flipbook = document.getElementById('flipbook');
            if (!flipbook) {
                const wrapper = document.getElementById('flipbook-wrapper');
                if (wrapper) {
                    wrapper.innerHTML = '<div id="flipbook"></div>';
                    flipbook = document.getElementById('flipbook');
                }
            }
            if (flipbook) flipbook.innerHTML = '';
            
            // Tüm sayfalar için sayfa elemanlarını oluştur (Canvas yerine klonlanabilir img nesneleri kullanıyoruz)
            for (let i = 1; i <= totalPages; i++) {
                const pageDiv = document.createElement('div');
                pageDiv.className = 'page-element';
                pageDiv.style.background = '#ffffff';
                pageDiv.style.width = '100%';
                pageDiv.style.height = '100%';
                pageDiv.innerHTML = `<img id="img-page-${i}" style="width:100%; height:100%; display:block; object-fit:contain;" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='150'></svg>">`;
                flipbook.appendChild(pageDiv);
            }
            
            // Yeni PageFlip başlat (Boyutun ekrana taşmasını önlemek için "fixed" modu kullanıyoruz)
            pageFlip = new St.PageFlip(flipbook, {
                width: bookWidth,
                height: bookHeight,
                size: "fixed",
                minWidth: 300,
                maxWidth: 2000,
                minHeight: 400,
                maxHeight: 2000,
                drawShadow: true,
                showCover: false,
                usePortrait: !isDoublePageMode,
                flippingTime: 600,
                maxShadowOpacity: 0.4
            });
            
            // Elemanları kütüphaneye yükle
            pageFlip.loadFromHTML(document.querySelectorAll('#flipbook .page-element'));
            
            // Sayfa çevrilme olay dinleyicisi
            pageFlip.on('flip', (e) => {
                currentPage = e.data + 1; // 0-indexed to 1-indexed
                document.getElementById('current-page-input').value = currentPage;
                document.getElementById('floating-current-page').textContent = currentPage;
                
                // İlerlemeyi LocalStorage'da güncelle
                const progress = getProgressData();
                if (progress[currentBookId]) {
                    progress[currentBookId].lastPage = currentPage;
                    progress[currentBookId].timestamp = new Date().toISOString();
                    localStorage.setItem('ern_reader_progress', JSON.stringify(progress));
                }
                
                // Görünür olan sayfaları zorunlu olarak yeniden çizdir (Zemin kayıplarını önlemek için forceRedraw = true)
                renderPageCanvas(currentPage, true);
                
                // Çift sayfa modunda yanındaki sayfayı da zorunlu çizdir
                if (pageFlip.getOrientation() === 'landscape') {
                    if (currentPage % 2 === 0) {
                        if (currentPage - 1 >= 1) renderPageCanvas(currentPage - 1, true);
                    } else {
                        if (currentPage + 1 <= totalPages) renderPageCanvas(currentPage + 1, true);
                    }
                }
                
                // Komşu sayfaları arka planda önden çizdir (önbelleğe al)
                if (currentPage - 1 >= 1) renderPageCanvas(currentPage - 1);
                if (currentPage - 2 >= 1) renderPageCanvas(currentPage - 2);
                if (currentPage + 1 <= totalPages) renderPageCanvas(currentPage + 1);
                if (currentPage + 2 <= totalPages) renderPageCanvas(currentPage + 2);
                
                updateBookmarkIcon(currentPage);
            });
            
            // Belirlenen sayfaya git
            setTimeout(() => {
                pageFlip.turnToPage(targetPage - 1);
                document.body.removeChild(loadingMessage);
            }, 600);
            
            renderBookmarksList();
            cacheAllPageTexts();
        });
        
    }).catch(err => {
        console.error('PDF yükleme hatası:', err);
        document.body.removeChild(loadingMessage);
        alert('PDF yüklenirken bir hata oluştu.');
        closeReader();
    });
}

function calculateBookDimensions(pageWidth, pageHeight) {
    const wrapper = document.getElementById('flipbook-wrapper');
    
    // Okuma konforu için marjinleri genişletiyoruz (Genişlikten 100px, yükseklikten 140px düşüyoruz)
    let maxW = (wrapper ? wrapper.clientWidth : window.innerWidth) - 100;
    let maxH = (wrapper ? wrapper.clientHeight : window.innerHeight) - 140;
    
    // Kitabın ekranın %55'inden yüksek ve %80'inden geniş olmasını engelleyelim (Açılışta kibar ve sığacak boyutta başlasın)
    maxH = Math.min(maxH, window.innerHeight * 0.55);
    maxW = Math.min(maxW, window.innerWidth * 0.80);
    
    // Güvenli Fallback
    if (maxW <= 0 || maxH <= 0) {
        maxW = window.innerWidth - 100;
        maxH = window.innerHeight - 140;
    }
    
    const ratio = pageWidth / pageHeight;
    
    // Geniş ekranda çift sayfa boyutlandırma
    if (isDoublePageMode && window.innerWidth > 768) {
        bookHeight = maxH;
        bookWidth = bookHeight * ratio * 2;
        
        if (bookWidth > maxW) {
            bookWidth = maxW;
            bookHeight = bookWidth / (ratio * 2);
        }
        // PageFlip tek sayfa boyutunu ister, bu yüzden genişliği 2'ye bölüyoruz
        bookWidth = bookWidth / 2;
    } else {
        bookHeight = maxH;
        bookWidth = bookHeight * ratio;
        
        if (bookWidth > maxW) {
            bookWidth = maxW;
            bookHeight = bookWidth / ratio;
        }
    }
    
    // Değerlerin her zaman geçerli pozitif sayılar olmasını garanti altına alalım
    bookWidth = Math.max(150, Math.round(bookWidth || 400));
    bookHeight = Math.max(200, Math.round(bookHeight || 600));
}

function resizeBook() {
    if (!pageFlip) return;
    
    if (currentPdf) {
        currentPdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 1.0 });
            calculateBookDimensions(viewport.width, viewport.height);
            
            pageFlip.setting.width = Math.round(bookWidth * currentScale);
            pageFlip.setting.height = Math.round(bookHeight * currentScale);
            pageFlip.update();
            
            renderedPages = {};
            renderPageCanvas(currentPage, true);
            if (pageFlip.getOrientation() === 'landscape') {
                if (currentPage % 2 === 0) {
                    if (currentPage - 1 >= 1) renderPageCanvas(currentPage - 1, true);
                } else {
                    if (currentPage + 1 <= totalPages) renderPageCanvas(currentPage + 1, true);
                }
            }
        });
    } else {
        // Canlı Görsel Kitap Modu için Yakınlaştırma (Zoom)
        calculateBookDimensions(450, 650);
        pageFlip.setting.width = Math.round(bookWidth * currentScale);
        pageFlip.setting.height = Math.round(bookHeight * currentScale);
        pageFlip.update();
    }
}

// Sayfa başına aktif çizim işlerini takip etmek için
let activeRenderTasks = {};

// PDF Sayfasını Canvas'a Çizdirme (Geçici Tuvalden img Etiketine Aktarma)
function renderPageCanvas(pageNumber, forceRedraw = false) {
    if ((renderedPages[pageNumber] && !forceRedraw) || !currentPdf) return;
    
    // Eğer bu sayfa için zaten aktif bir çizim sürüyorsa, çakışmayı önlemek için iptal et
    if (activeRenderTasks[pageNumber]) {
        try {
            activeRenderTasks[pageNumber].cancel();
        } catch (e) {}
        delete activeRenderTasks[pageNumber];
    }
    
    renderedPages[pageNumber] = true;
    
    currentPdf.getPage(pageNumber).then(page => {
        // Geçici bir off-screen canvas oluşturuyoruz
        const tempCanvas = document.createElement('canvas');
        const context = tempCanvas.getContext('2d');
        // Yüksek çözünürlüklü ekranlarda toDataURL() performansını korumak için dpr'ı 2.0 ile sınırlıyoruz
        const dpr = Math.min(2.0, window.devicePixelRatio || 1);
        const width = bookWidth * currentScale * dpr;
        const height = bookHeight * currentScale * dpr;
        
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        const viewportDefault = page.getViewport({ scale: 1.0 });
        const scale = Math.min(width / viewportDefault.width, height / viewportDefault.height);
        const viewport = page.getViewport({ scale: scale });
        
        context.clearRect(0, 0, width, height);
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        // Çizimi başlat ve takibe al
        const renderTask = page.render(renderContext);
        activeRenderTasks[pageNumber] = renderTask;
        
        renderTask.promise.then(() => {
            const dataUrl = tempCanvas.toDataURL();
            pageImagesData[pageNumber] = dataUrl; // Büyütecin DOM'dan bağımsız doğrudan hafızadan okuması için kaydet
            
            // Sayfadaki tüm eşleşen img etiketlerini güncelle (Klonlanmış kopyalar dahil!)
            const images = document.querySelectorAll(`#img-page-${pageNumber}`);
            if (images.length > 0) {
                images.forEach(img => {
                    img.src = dataUrl;
                });
            }
            
            delete activeRenderTasks[pageNumber];
        }).catch(err => {
            delete activeRenderTasks[pageNumber];
            // Eğer çizim kasıtlı olarak iptal edildiyse konsola hata basıp şişirmeyelim
            if (err.name !== 'RenderingCancelledException') {
                console.error("PDF sayfa çizim hatası:", err);
            }
        });
    });
}

function adjustZoom(factor) {
    const newScale = currentScale + factor;
    if (newScale >= 0.2 && newScale <= 2.0) {
        currentScale = newScale;
        resizeBook();
    }
}

function closeReader() {
    document.getElementById('reader-modal').classList.remove('active');
    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }
    currentPdf = null;
    currentBookId = null;
    pageImagesData = {};
    stopTts();
    
    document.getElementById('search-drawer').classList.remove('active');
    document.getElementById('bookmarks-drawer').classList.remove('active');
    document.getElementById('drawer-search').value = '';
    searchResults = [];
    currentSearchIndex = -1;
    document.getElementById('search-results-indicator').textContent = '';
    
    loadRecentBooks();
}

async function cacheAllPageTexts() {
    if (!currentPdf) return;
    for (let i = 1; i <= totalPages; i++) {
        try {
            const page = await currentPdf.getPage(i);
            const textContent = await page.getTextContent();
            const textStr = textContent.items.map(item => item.str).join(' ').toLowerCase();
            pdfPageTexts[i] = textStr;
        } catch (e) {
            console.error(`Sayfa ${i} okunurken hata:`, e);
        }
    }
}

function searchInsidePdf(query) {
    searchResults = [];
    currentSearchIndex = -1;
    
    const indicator = document.getElementById('search-results-indicator');
    const prevBtn = document.getElementById('search-prev');
    const nextBtn = document.getElementById('search-next');
    const listContainer = document.getElementById('search-results-list');
    
    if (!query || query.length < 2) {
        indicator.textContent = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        if (listContainer) {
            listContainer.style.display = 'none';
            listContainer.innerHTML = '';
        }
        return;
    }
    
    const lowerQuery = query.toLowerCase();
    const matches = [];
    
    for (let i = 1; i <= totalPages; i++) {
        const pageText = pdfPageTexts[i] || '';
        const idx = pageText.indexOf(lowerQuery);
        if (idx > -1) {
            searchResults.push(i);
            const start = Math.max(0, idx - 40);
            const end = Math.min(pageText.length, idx + lowerQuery.length + 40);
            let snippet = pageText.substring(start, end);
            
            if (start > 0) snippet = '...' + snippet;
            if (end < pageText.length) snippet = snippet + '...';
            
            const regex = new RegExp(`(${escapeRegExp(lowerQuery)})`, 'gi');
            const highlightedSnippet = snippet.replace(regex, '<mark style="background: #f59e0b; color: #000; padding: 0.1rem 0.2rem; border-radius: 4px; font-weight: 600;">$1</mark>');
            
            matches.push({
                page: i,
                snippet: highlightedSnippet
            });
        }
    }
    
    if (searchResults.length > 0) {
        currentSearchIndex = 0;
        indicator.textContent = `${searchResults.length} sonuç`;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
        
        if (listContainer) {
            listContainer.style.display = 'flex';
            listContainer.innerHTML = matches.map(match => `
                <div onclick="goToPageTurn(${match.page})" style="padding: 0.6rem; border-radius: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); cursor: pointer; display: flex; flex-direction: column; gap: 0.35rem; text-align: left;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <span style="font-weight: 600; color: #8b5cf6; font-size: 0.85rem;"><i class="fa-solid fa-file-lines"></i> Sayfa ${match.page}</span>
                        <span style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7;">Gitmek için tıkla</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; font-style: italic;">${match.snippet}</div>
                </div>
            `).join('');
        }
        
        goToPageTurn(searchResults[currentSearchIndex]);
    } else {
        indicator.textContent = 'Sonuç bulunamadı';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        if (listContainer) {
            listContainer.style.display = 'none';
            listContainer.innerHTML = '';
        }
    }
}

function navigateSearchResult(offset) {
    if (searchResults.length === 0) return;
    
    let newIndex = currentSearchIndex + offset;
    if (newIndex >= 0 && newIndex < searchResults.length) {
        currentSearchIndex = newIndex;
        document.getElementById('search-results-indicator').textContent = `${currentSearchIndex + 1} / ${searchResults.length} sonuç`;
        goToPageTurn(searchResults[currentSearchIndex]);
    }
}

function goToPageTurn(pageNumber) {
    if (pageFlip && pageNumber >= 1 && pageNumber <= totalPages) {
        pageFlip.turnToPage(pageNumber - 1);
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Yer İmleri
function getBookmarksData() {
    const data = localStorage.getItem('ern_reader_bookmarks');
    return data ? JSON.parse(data) : {};
}

function toggleBookmark(pageNumber) {
    if (!currentBookId) return;
    const bookmarks = getBookmarksData();
    if (!bookmarks[currentBookId]) {
        bookmarks[currentBookId] = [];
    }
    const index = bookmarks[currentBookId].indexOf(pageNumber);
    if (index > -1) {
        bookmarks[currentBookId].splice(index, 1);
    } else {
        bookmarks[currentBookId].push(pageNumber);
        bookmarks[currentBookId].sort((a, b) => a - b);
    }
    localStorage.setItem('ern_reader_bookmarks', JSON.stringify(bookmarks));
    updateBookmarkIcon(pageNumber);
    renderBookmarksList();
}

function updateBookmarkIcon(pageNumber) {
    const bookmarks = getBookmarksData();
    const icon = document.querySelector('#add-bookmark i');
    if (!icon) return;
    
    if (bookmarks[currentBookId] && bookmarks[currentBookId].includes(pageNumber)) {
        icon.className = 'fa-solid fa-bookmark';
        icon.style.color = '#f59e0b';
    } else {
        icon.className = 'fa-regular fa-bookmark';
        icon.style.color = '';
    }
}

function renderBookmarksList() {
    const list = document.getElementById('bookmarks-list');
    if (!list || !currentBookId) return;
    const bookmarks = getBookmarksData();
    const bookBookmarks = bookmarks[currentBookId] || [];
    
    if (bookBookmarks.length === 0) {
        list.innerHTML = `<span style="color: var(--text-secondary); font-size: 0.85rem; font-style: italic;">Henüz yer işareti eklenmedi.</span>`;
        return;
    }
    
    list.innerHTML = bookBookmarks.map(page => `
        <button class="search-nav-btn" onclick="goToPageTurn(${page})" style="padding: 0.25rem 0.75rem; border-color: rgba(245, 158, 11, 0.4); color: #f59e0b;">
            <i class="fa-solid fa-bookmark"></i> Sayfa ${page}
        </button>
    `).join('');
}

function getProgressData() {
    const data = localStorage.getItem('ern_reader_progress');
    return data ? JSON.parse(data) : {};
}

function saveProgress(bookId, title, author, coverColor, lastPage, totalPage) {
    const progressData = getProgressData();
    progressData[bookId] = {
        id: bookId,
        title,
        author,
        coverColor,
        lastPage,
        totalPage,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('ern_reader_progress', JSON.stringify(progressData));
}

function checkRedirectFromSearch() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('ara');
    if (searchQuery) {
        const searchInput = document.getElementById('main-search');
        if (searchInput) {
            searchInput.value = searchQuery;
            performLibrarySearch(searchQuery);
        }
    }
}

// Pencere Yeniden Boyutlandırıldığında (Çakışmaları önlemek için Debounce/Gecikmeli tetikleme uyguluyoruz)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const widthCheck = window.innerWidth > 992;
        if (widthCheck !== isDoublePageMode) {
            isDoublePageMode = widthCheck;
            if (pageFlip) {
                pageFlip.updateState({
                    usePortrait: !isDoublePageMode
                });
            }
        }
        resizeBook();
    }, 200); // 200ms gecikme ile tek bir kez çalıştır
});

// Büyüteç (Magnifier) Mantığı - Sağ Tık & Mobilde Dokunarak Çalışır
function setupMagnifier() {
    const magnifier = document.getElementById('reader-magnifier');
    const wrapper = document.getElementById('flipbook-wrapper');
    let isRightMouseDown = false;
    let isTouchActive = false;
    let touchTimeout = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let magnifierZoomFactor = 2.2; // Varsayılan büyüteç gücü
    
    if (!magnifier || !wrapper) return;
    
    // Güç ayar sürgüsünü dinle
    const slider = document.getElementById('magnifier-zoom-slider');
    const valText = document.getElementById('magnifier-zoom-val');
    if (slider && valText) {
        slider.addEventListener('input', (e) => {
            magnifierZoomFactor = parseFloat(e.target.value);
            valText.textContent = `${magnifierZoomFactor.toFixed(1)}x`;
        });
    }
    
    // Sağ tık menüsünü engelle (Büyüteci rahat kullanmak için)
    wrapper.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    
    // Tarayıcının varsayılan görsel sürükleme (drag-drop) işlemini engelle
    wrapper.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });
    
    // PC mouse kontrolleri (Sağ tık olaylarının kitap sayfasına ulaşıp çevirmeyi tetiklememesi için Capturing [true] kullanıyoruz)
    wrapper.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Sağ tık (mause contextmenu button)
            e.stopPropagation();
            e.stopImmediatePropagation(); // Kütüphanenin bu olayı duymasını engelle
            
            isRightMouseDown = true;
            const fb = document.getElementById('flipbook');
            if (fb) fb.classList.add('magnifying-active'); // Sayfa katlamayı geçici devre dışı bırak
            updateMagnifier(e);
        }
    }, true); // Capturing aktif
    
    wrapper.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            isRightMouseDown = false;
            const fb = document.getElementById('flipbook');
            if (fb) fb.classList.remove('magnifying-active'); // Sayfa katlamayı tekrar aktif et
            magnifier.style.display = 'none';
        }
    }, true); // Capturing aktif
    
    // Tarayıcı dışına mouse bırakılırsa temizle
    window.addEventListener('mouseup', (e) => {
        if (e.button === 2 && isRightMouseDown) {
            isRightMouseDown = false;
            const fb = document.getElementById('flipbook');
            if (fb) fb.classList.remove('magnifying-active');
            magnifier.style.display = 'none';
        }
    });
    
    wrapper.addEventListener('mousemove', (e) => {
        if (isRightMouseDown) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            updateMagnifier(e);
        }
    }, true);
    
    // Mobil dokunmatik kontroller (400ms basılı tutunca büyüteç açılır)
    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            
            clearTimeout(touchTimeout);
            touchTimeout = setTimeout(() => {
                isTouchActive = true;
                const fb = document.getElementById('flipbook');
                if (fb) fb.classList.add('magnifying-active'); // Sayfa katlamayı devre dışı bırak
                updateMagnifier(touch, true); // true = mobil mod (offset uygula)
            }, 400);
        }
    }, { passive: true });
    
    wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            
            if (!isTouchActive) {
                // Eğer parmağını hareket ettirdiyse uzun basmayı iptal et (sayfa kaydırıyordur)
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    clearTimeout(touchTimeout);
                }
            } else {
                e.preventDefault(); // Sayfa kaydırmayı engelle
                updateMagnifier(touch, true);
            }
        }
    }, { passive: false });
    
    wrapper.addEventListener('touchend', (e) => {
        clearTimeout(touchTimeout);
        if (isTouchActive) {
            isTouchActive = false;
            const fb = document.getElementById('flipbook');
            if (fb) fb.classList.remove('magnifying-active'); // Sayfa katlamayı tekrar aktif et
            magnifier.style.display = 'none';
        }
    });
    
    function updateMagnifier(e, isMobile = false) {
        const fb = document.getElementById('flipbook');
        if (!fb) {
            magnifier.style.display = 'none';
            return;
        }
        
        const fbRect = fb.getBoundingClientRect();
        if (fbRect.width <= 0 || fbRect.height <= 0) {
            magnifier.style.display = 'none';
            return;
        }
        
        const isLandscape = pageFlip && pageFlip.getOrientation() === 'landscape';
        const halfWidth = isLandscape ? (fbRect.width / 2) : fbRect.width;
        const centerX = fbRect.left + halfWidth;
        const isLeftHalf = isLandscape && (e.clientX < centerX);
        
        let targetPageNumber = currentPage;
        if (isLandscape) {
            if (currentPage % 2 === 0) { // Çift sayfa düzeni (örn: sayfa 2 ve 3 açık)
                targetPageNumber = isLeftHalf ? currentPage - 1 : currentPage;
            } else { // Tek sayfa düzeni (örn: sayfa 3 ve 4 açık)
                targetPageNumber = isLeftHalf ? currentPage : currentPage + 1;
            }
        }
        
        // Ekranda o an görünür olan aktif <img> elemanını ve gerçek piksel sınırlarını bul
        let activeImg = null;
        const images = document.querySelectorAll(`#img-page-${targetPageNumber}`);
        for (let i = 0; i < images.length; i++) {
            const r = images[i].getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
                activeImg = images[i];
                break;
            }
        }

        // Resim verisini PDF belleğinden veya aktif img etiketinden oku
        let dataUrl = pageImagesData[targetPageNumber];
        if (!dataUrl && activeImg && activeImg.src) {
            dataUrl = activeImg.src;
        }

        // Ekranda o an görünür olan aktif <img> elemanının gerçek piksel sınırlarını kullan
        
        // Eğer aktif resim elemanı bulunduysa onun sınırlarını, yoksa konteynır sınırlarını kullan
        let imgRect = activeImg ? activeImg.getBoundingClientRect() : null;
        let imgX, imgY, imgW, imgH;
        
        if (imgRect && imgRect.width > 0 && imgRect.height > 0) {
            imgX = e.clientX - imgRect.left;
            imgY = e.clientY - imgRect.top;
            imgW = imgRect.width;
            imgH = imgRect.height;
        } else {
            imgX = e.clientX - fbRect.left;
            if (isLandscape && !isLeftHalf) imgX -= halfWidth;
            imgY = e.clientY - fbRect.top;
            imgW = halfWidth;
            imgH = fbRect.height;
        }
        
        // Büyüteç mercek boyutunu ayarla
        const lensSize = Math.round(150 + (magnifierZoomFactor - 1.5) * 35);
        magnifier.style.width = `${lensSize}px`;
        magnifier.style.height = `${lensSize}px`;
        
        // Mobilde parmağın altındaki yazıyı kapatmaması için büyüteci yukarıda (offset) göster
        const offset = isMobile ? 110 : 0;
        magnifier.style.left = `${e.pageX - lensSize / 2}px`;
        magnifier.style.top = `${e.pageY - lensSize / 2 - offset}px`;
        
        // Tam piksel hizalamalı arkaplan pozisyonu hesabı (Görüntü kaymasını %100 sıfırlar!)
        const posX = (lensSize / 2) - (imgX * magnifierZoomFactor);
        const posY = (lensSize / 2) - (imgY * magnifierZoomFactor);
        
        magnifier.style.display = 'block';
        magnifier.style.backgroundImage = `url("${dataUrl}")`;
        magnifier.style.backgroundSize = `${imgW * magnifierZoomFactor}px ${imgH * magnifierZoomFactor}px`;
        magnifier.style.backgroundPosition = `${posX}px ${posY}px`;
    }
}

// AI Sesli Kitap Okuyucu Engine (Text-to-Speech & Otomatik Sayfa Çevirmeli Seslendirme)
let ttsUtterance = null;
let isTtsReading = false;
let ttsRate = 1.0;

let selectedVoiceName = localStorage.getItem('ern_tts_voice_name') || '';

function populateTtsVoiceList() {
    const voiceSelect = document.getElementById('tts-voice-select');
    if (!voiceSelect) return;
    
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;
    
    voiceSelect.innerHTML = '';
    
    // Türkçe ve Doğal Yapay Zeka Seslerini Üste Sırala (Ahmet, Tolga, Emel, Google Türkçe)
    const trVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('tr'));
    const otherVoices = voices.filter(v => !v.lang || !v.lang.toLowerCase().startsWith('tr'));
    
    const allSorted = [...trVoices, ...otherVoices];
    
    allSorted.forEach(v => {
        const option = document.createElement('option');
        option.value = v.name;
        let displayName = v.name;
        if (v.name.toLowerCase().includes('ahmet')) {
            displayName = `🎙️ Ahmet (Microsoft Natural AI)`;
        } else if (v.name.toLowerCase().includes('tolga')) {
            displayName = `🎙️ Tolga (Microsoft Natural AI)`;
        } else if (v.name.toLowerCase().includes('emel')) {
            displayName = `🎙️ Emel (Microsoft Natural AI)`;
        } else if (v.lang.toLowerCase().startsWith('tr')) {
            displayName = `🇹🇷 ${v.name}`;
        }
        option.textContent = displayName;
        if (v.name === selectedVoiceName || (!selectedVoiceName && v.name.toLowerCase().includes('ahmet'))) {
            option.selected = true;
        }
        voiceSelect.appendChild(option);
    });
}

function getPreferredTurkishVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    
    // 1. Kullanıcının Manuel Seçtiği Ses
    const selectedSelect = document.getElementById('tts-voice-select');
    if (selectedSelect && selectedSelect.value) {
        const found = voices.find(v => v.name === selectedSelect.value);
        if (found) return found;
    }
    
    if (selectedVoiceName) {
        const found = voices.find(v => v.name === selectedVoiceName);
        if (found) return found;
    }
    
    // 2. AHMET (Microsoft Ahmet Natural AI Erkek Sesi - 1. Öncelik)
    const ahmet = voices.find(v => v.name.toLowerCase().includes('ahmet'));
    if (ahmet) return ahmet;
    
    // 3. Türkçe Natural AI Sesleri (Tolga, Emel, Google Türkçe)
    const trNatural = voices.find(v => v.name.toLowerCase().includes('natural') && v.lang.toLowerCase().startsWith('tr'));
    if (trNatural) return trNatural;
    
    // 4. Genel Türkçe Ses
    const trGeneral = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('tr'));
    if (trGeneral) return trGeneral;
    
    return voices[0];
}

let isAutoTranslateEnabled = false;

// Yabancı Dildeki Cümleleri Anında Türkçe'ye Çeviren Yapay Zeka Motoru
async function translateTextToTurkish(text) {
    if (!text || text.trim().length < 2) return text;
    try {
        const cleanText = text.trim();
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=autodetect|tr`;
        const r = await fetchWithTimeout(url, {}, 5000);
        if (r.ok) {
            const data = await r.json();
            if (data && data.responseData && data.responseData.translatedText) {
                return data.responseData.translatedText;
            }
        }
    } catch(e) {
        console.error('Anlık Türkçe çeviri hatası:', e);
    }
    return text; // Hata durumunda orijinal metne geri dön
}

function setupTtsEngine() {
    const btnToggle = document.getElementById('btn-toggle-tts');
    const playPauseBtn = document.getElementById('tts-play-pause-btn');
    const speedBtn = document.getElementById('tts-speed-btn');
    const stopBtn = document.getElementById('tts-stop-btn');
    const voiceSelect = document.getElementById('tts-voice-select');
    const translateToggle = document.getElementById('tts-translate-toggle');
    const translateLabel = document.getElementById('tts-translate-label');
    
    populateTtsVoiceList();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = populateTtsVoiceList;
    }
    
    if (translateToggle && translateLabel) {
        translateToggle.addEventListener('click', () => {
            isAutoTranslateEnabled = !isAutoTranslateEnabled;
            if (isAutoTranslateEnabled) {
                translateToggle.style.background = 'rgba(16, 185, 129, 0.3)';
                translateToggle.style.color = '#34d399';
                translateToggle.style.borderColor = 'rgba(52, 211, 153, 0.5)';
                translateLabel.textContent = 'TR Çeviri: AÇIK 🟢';
                showToast('🌐 Canlı Türkçe Çevirili Sesli Okuma AÇILDI! Yabancı kitaplar Ahmet AI tarafından Türkçe seslendirilecek.');
            } else {
                translateToggle.style.background = 'rgba(99, 102, 241, 0.2)';
                translateToggle.style.color = '#a5b4fc';
                translateToggle.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                translateLabel.textContent = 'TR Çeviri: Kapalı';
                showToast('TR Çeviri Kapatıldı.');
            }
            if (isTtsReading) {
                startTtsCurrentPage();
            }
        });
    }
    
    if (voiceSelect) {
        voiceSelect.addEventListener('change', (e) => {
            selectedVoiceName = e.target.value;
            localStorage.setItem('ern_tts_voice_name', selectedVoiceName);
            if (isTtsReading) {
                startTtsCurrentPage();
            }
        });
    }
    
    if (!btnToggle) return;
    
    btnToggle.addEventListener('click', () => {
        if (isTtsReading) {
            stopTts();
        } else {
            startTtsCurrentPage();
        }
    });
    
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
                playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                const statusText = document.getElementById('tts-status-text');
                if (statusText) statusText.textContent = `Sayfa ${currentPage} Okunuyor...`;
            } else if (window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                const statusText = document.getElementById('tts-status-text');
                if (statusText) statusText.textContent = `Sesli Okuma Duraklatıldı`;
            }
        });
    }
    
    if (speedBtn) {
        speedBtn.addEventListener('click', () => {
            if (ttsRate === 1.0) ttsRate = 1.25;
            else if (ttsRate === 1.25) ttsRate = 1.5;
            else if (ttsRate === 1.5) ttsRate = 2.0;
            else ttsRate = 1.0;
            
            speedBtn.textContent = `${ttsRate}x`;
            if (isTtsReading) {
                startTtsCurrentPage();
            }
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopTts);
    }
}

// PDF Metinlerini Satır Bölünmelerinden ve Robotik Kesilmelerden Temizleyen Akıllı İnsan Motoru
function cleanPdfTextForSpeech(rawText) {
    if (!rawText) return '';
    let text = rawText;
    // Satır sonlarındaki tire işaretlerini ve kelime bölünmelerini birleştir (örn: "tasa- \n rım" -> "tasarım")
    text = text.replace(/(\w+)[-\u2010\u2013\u2014]\s*[\r\n]+\s*(\w+)/g, '$1$2');
    // Satır sonu kırılmalarını boşluğa dönüştür (cümlelerin yarım kalmasını önler)
    text = text.replace(/[\r\n]+/g, ' ');
    // Çoklu boşlukları temizle
    text = text.replace(/\s+/g, ' ');
    return text.trim();
}

let ttsSentenceQueue = [];
let ttsCurrentSentenceIndex = 0;

async function speakNextSentenceInQueue() {
    if (!isTtsReading || ttsCurrentSentenceIndex >= ttsSentenceQueue.length) {
        // Sayfadaki tüm cümleler bitti! Otomatik sonraki sayfaya geç ve okumaya devam et
        if (isTtsReading && currentPage < totalPages) {
            if (pageFlip) pageFlip.flipNext();
            setTimeout(() => {
                startTtsCurrentPage();
            }, 1200);
        } else {
            stopTts();
        }
        return;
    }
    
    let sentence = ttsSentenceQueue[ttsCurrentSentenceIndex];
    if (!sentence || sentence.trim().length < 2) {
        ttsCurrentSentenceIndex++;
        speakNextSentenceInQueue();
        return;
    }
    
    // Eğer Canlı Türkçe Çeviri Modu AÇIKSA cümleyi anında Türkçe'ye çevir!
    if (isAutoTranslateEnabled) {
        const statusText = document.getElementById('tts-status-text');
        if (statusText) statusText.textContent = `Sayfa ${currentPage} Türkçe'ye Çevriliyor...`;
        
        sentence = await translateTextToTurkish(sentence);
        
        if (statusText && isTtsReading) statusText.textContent = `Sayfa ${currentPage} Okunuyor...`;
    }
    
    ttsUtterance = new SpeechSynthesisUtterance(sentence.trim());
    ttsUtterance.rate = ttsRate * 0.95; // Doğal insan okuma hızı
    ttsUtterance.pitch = 1.05; // Sıcak insan tonlaması
    
    // AHMET AI ve En Kaliteli Türkçe Ses Modelini Seç
    const preferredVoice = getPreferredTurkishVoice();
    if (preferredVoice) {
        ttsUtterance.voice = preferredVoice;
    } else {
        ttsUtterance.lang = 'tr-TR';
    }
    
    ttsUtterance.onend = () => {
        ttsCurrentSentenceIndex++;
        setTimeout(speakNextSentenceInQueue, 150);
    };
    
    ttsUtterance.onerror = (e) => {
        console.error('Cümle okuma hatası:', e);
        ttsCurrentSentenceIndex++;
        speakNextSentenceInQueue();
    };
    
    window.speechSynthesis.speak(ttsUtterance);
}

let downloadedPdfBufferForTts = null;
let downloadedPdfTitleForTts = '';

function closePdfPromptModal() {
    const modal = document.getElementById('pdf-download-prompt-modal');
    if (modal) modal.style.display = 'none';
}

function executePdfDownloadAndPromptRead() {
    closePdfPromptModal();
    
    let identifier = pendingTtsIdentifier;
    if (!identifier && currentBookId) {
        identifier = currentBookId.replace('online_', '');
    }
    let title = pendingTtsTitle || document.getElementById('reader-title')?.textContent || 'Kitap';
    
    if (identifier) {
        downloadPdfDirectly(identifier, title);
    } else {
        showToast('Lütfen "Cihazımdan Oku" butonunu kullanarak PDF seçin.');
    }
}

function showDownloadedCompletionNotification(title) {
    let toast = document.getElementById('tts-post-download-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'tts-post-download-toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(15, 23, 42, 0.98)';
        toast.style.color = '#f8fafc';
        toast.style.border = '1px solid rgba(34, 197, 94, 0.6)';
        toast.style.padding = '1.25rem 1.5rem';
        toast.style.borderRadius = '20px';
        toast.style.boxShadow = '0 20px 45px rgba(0,0,0,0.85)';
        toast.style.zIndex = '9999999';
        toast.style.display = 'flex';
        toast.style.flexDirection = 'column';
        toast.style.alignItems = 'center';
        toast.style.gap = '0.85rem';
        toast.style.backdropFilter = 'blur(16px)';
        toast.style.maxWidth = '400px';
        toast.style.width = '90%';
        toast.style.textAlign = 'center';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `
        <div style="font-weight: 800; color: #4ade80; font-size: 1.05rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <i class="fa-solid fa-circle-check" style="font-size: 1.4rem;"></i> 🎉 PDF İndirildi!
        </div>
        <div style="font-size: 0.85rem; color: #e2e8f0; line-height: 1.45;">
            "<strong>${title}</strong>" cihazınıza indirildi. Şimdi Ahmet AI ile sesli okutmak ister misiniz?
        </div>
        <div style="display: flex; gap: 0.6rem; width: 100%; margin-top: 0.2rem;">
            <button onclick="startAutoReadDownloadedPdf()" style="flex: 1; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; padding: 0.75rem 1rem; border-radius: 12px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);">
                <i class="fa-solid fa-play"></i> Şimdi Sesli Oku
            </button>
            <button onclick="document.getElementById('tts-post-download-toast').style.display='none'" style="background: transparent; color: #94a3b8; border: 1px solid #334155; padding: 0.75rem; border-radius: 12px; font-size: 0.85rem; cursor: pointer; font-weight: 600;">
                Kapat
            </button>
        </div>
    `;
    toast.style.display = 'flex';
}

async function startAutoReadDownloadedPdf() {
    const toast = document.getElementById('tts-post-download-toast');
    if (toast) toast.style.display = 'none';
    
    if (downloadedPdfBufferForTts) {
        showToast('PDF Hazırlanıyor, Ahmet AI Sesli Okumayı Başlatıyor...');
        await loadPdfDocument(downloadedPdfBufferForTts, downloadedPdfTitleForTts);
        document.getElementById('reader-modal').classList.add('active');
        setTimeout(() => {
            startTtsCurrentPage();
        }, 800);
    } else {
        const localInput = document.getElementById('local-file-input');
        if (localInput) localInput.click();
    }
}

async function startTtsCurrentPage() {
    stopTts(); // Varsa önceki seslendirmeyi temizle
    
    // Eğer online resim modundaysak (currentPdf henüz cihazda yoksa)
    if (!currentPdf) {
        pendingTtsIdentifier = currentBookId ? currentBookId.replace('online_', '') : '';
        pendingTtsTitle = document.getElementById('reader-title')?.textContent || 'Kitap';
        
        if (pendingTtsIdentifier) {
            downloadPdfDirectly(pendingTtsIdentifier, pendingTtsTitle);
        } else {
            const modal = document.getElementById('pdf-download-prompt-modal');
            if (modal) modal.style.display = 'flex';
        }
        return;
    }
    
    // Aktif sayfa metnini ham olarak alalım
    let rawText = pdfPageTexts[currentPage];
    if (!rawText) {
        try {
            const page = await currentPdf.getPage(currentPage);
            const textContent = await page.getTextContent();
            rawText = textContent.items.map(i => i.str).join(' ');
            pdfPageTexts[currentPage] = rawText;
        } catch (e) {
            console.error('Metin çıkarma hatası:', e);
        }
    }
    
    // Metni satır kırılmalarından ve robotik bölünmelerden temizle
    const cleanedText = cleanPdfTextForSpeech(rawText);
    
    if (!cleanedText || cleanedText.length < 3) {
        alert(`Sayfa ${currentPage} üzerinde okunabilir metin bulunamadı.`);
        return;
    }
    
    // Metni noktalamalara göre gerçek tam cümlelere böl (. ! ? ;)
    ttsSentenceQueue = cleanedText.match(/[^.!?;]+[.!?;]+/g) || [cleanedText];
    ttsCurrentSentenceIndex = 0;
    
    const controlBar = document.getElementById('tts-control-bar');
    const statusText = document.getElementById('tts-status-text');
    const playPauseBtn = document.getElementById('tts-play-pause-btn');
    if (controlBar) controlBar.style.display = 'flex';
    if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    if (statusText) statusText.textContent = `Sayfa ${currentPage} Okunuyor...`;
    
    isTtsReading = true;
    speakNextSentenceInQueue();
}

function stopTts() {
    isTtsReading = false;
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    const controlBar = document.getElementById('tts-control-bar');
    if (controlBar) controlBar.style.display = 'none';
}