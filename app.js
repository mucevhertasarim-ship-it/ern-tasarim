document.addEventListener('DOMContentLoaded', () => {
    renderPortfolio();
    initPortfolioFilters();
    initCustomForm();
});

// Portföyü Veritabanından (LocalStorage) veya Varsayılandan Yükleme
function renderPortfolio() {
    const grid = document.getElementById('portfolio-items');
    if (!grid) return;
    
    const customItems = getCustomPortfolioItems();
    if (customItems.length === 0) {
        // Eğer özel eklenen ürün yoksa HTML'deki varsayılan kaliteli SVG çizimleri korunsun
        return;
    }
    
    // Eğer yönetici panelinden ürün eklenmişse varsayılanları temizle ve bunları çizdir
    grid.innerHTML = customItems.map(item => `
        <div class="portfolio-item" data-category="${item.category}">
            <div class="portfolio-img-wrapper">
                <img src="${item.image}" class="portfolio-img" alt="${item.title}">
                <div class="portfolio-overlay">
                    <a href="siparis.html" class="btn-gold" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-pen-nib"></i> Benzerini Çizdir</a>
                </div>
            </div>
            <div class="portfolio-info">
                <div class="portfolio-category" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${item.category}</span>
                    <span style="color: var(--gold-primary); font-weight: 700; font-size: 0.95rem;">${item.price} TL</span>
                </div>
                <h3 class="portfolio-title" style="margin-top: 0.25rem;">${item.title}</h3>
                <div class="portfolio-desc">${item.desc}</div>
            </div>
        </div>
    `).join('');
}

function getCustomPortfolioItems() {
    const data = localStorage.getItem('ern_portfolio_items');
    return data ? JSON.parse(data) : [];
}

let currentSelectedProduct = '3D CAD Mücevher Modeli';

// 3D CAD Video & Görsel Sinematik Modal Gösterimi
function openMediaModal(mediaUrl, title, category) {
    const modal = document.getElementById('media-modal');
    const container = document.getElementById('modal-media-container');
    const titleEl = document.getElementById('modal-title');
    const catEl = document.getElementById('modal-category');
    
    if (!modal || !container) return;
    
    currentSelectedProduct = title;
    
    if (titleEl) titleEl.textContent = title;
    if (catEl) catEl.textContent = category;
    
    if (mediaUrl.endsWith('.glb')) {
        const posterUrl = mediaUrl.replace('.glb', '.jpg');
        container.innerHTML = `
            <div style="position: relative; width: 100%; height: 380px;">
                <model-viewer src="${mediaUrl}"
                              poster="${posterUrl}"
                              bounds="tight"
                              camera-controls
                              interaction-prompt="none"
                              shadow-intensity="1.5"
                              shadow-softness="0.8"
                              exposure="1.2"
                              environment-image="neutral"
                              style="width: 100%; height: 100%; background: radial-gradient(circle at center, #172033 0%, #080c16 100%); border-radius: 10px;">
                </model-viewer>
                <div style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.75); color: #d4af37; padding: 4px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; pointer-events: none; border: 1px solid rgba(212,175,55,0.4);">
                    <i class="fa-solid fa-hand-pointer"></i> Fareyle çevirin | Tekerlekle zoom yapın
                </div>
            </div>`;
    } else if (mediaUrl.includes('.mp4') || mediaUrl.includes('.webm')) {
        container.innerHTML = `<video src="${mediaUrl}" controls autoplay loop style="width:100%; max-height:350px; object-fit:contain; border-radius:8px;"></video>`;
    } else {
        container.innerHTML = `<img src="${mediaUrl}" style="width:100%; max-height:350px; object-fit:contain; border-radius:8px;">`;
    }
    
    modal.style.display = 'flex';
}

function closeMediaModal() {
    const modal = document.getElementById('media-modal');
    const container = document.getElementById('modal-media-container');
    if (container) container.innerHTML = '';
    if (modal) modal.style.display = 'none';
}

// WhatsApp İle Sipariş Gönderimi
function sendOrderViaWhatsApp() {
    const type = document.getElementById('order-type')?.value || '';
    const metal = document.getElementById('order-metal')?.value || '';
    const gram = document.getElementById('order-gram')?.value || '';
    const delivery = document.getElementById('order-delivery')?.value || '';
    const name = document.getElementById('order-name')?.value || '';
    const phone = document.getElementById('order-phone')?.value || '';
    const email = document.getElementById('order-email')?.value || '';
    
    if (!name || !phone) {
        alert('Lütfen Adınızı ve Telefon numaranızı giriniz.');
        return;
    }
    
    let msg = `Merhaba ERN Tasarım! 👋\n\n`;
    msg += `✨ *SİPARİŞ / ÇİZİM TALEBİ*\n`;
    msg += `📌 *Ürün:* ${currentSelectedProduct}\n`;
    msg += `🎨 *Talep Türü:* ${type}\n`;
    msg += `🟡 *Maden/Ayar:* ${metal}\n`;
    if (gram) msg += `⚖️ *Gram/Ölçü:* ${gram}\n`;
    msg += `🏬 *Teslimat:* ${delivery}\n\n`;
    msg += `👤 *Müşteri:* ${name}\n`;
    msg += `📞 *Tel:* ${phone}\n`;
    msg += `📧 *E-Posta:* ${email}\n\n`;
    msg += `_Sitedeki form üzerinden oluşturuldu._`;
    
    let waNum = '905320000000';
    try {
        const s = JSON.parse(localStorage.getItem('ern_site_settings'));
        if (s && s.whatsapp) waNum = s.whatsapp;
        
        const requests = JSON.parse(localStorage.getItem('ern_jewelry_requests')) || [];
        requests.push({
            id: 'ord_' + Date.now(),
            name: name,
            phone: phone,
            email: email,
            items: currentSelectedProduct,
            type: '💎 Hızlı Sipariş Formu',
            metal: metal,
            notes: `${type} | ${gram} | ${delivery}`,
            date: new Date().toLocaleDateString('tr-TR'),
            status: 'Bekliyor'
        });
        localStorage.setItem('ern_jewelry_requests', JSON.stringify(requests));
    } catch(e) {}
    
    const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
}

// E-Posta İle Sipariş Gönderimi
function submitProductOrder(e) {
    e.preventDefault();
    const type = document.getElementById('order-type')?.value || '';
    const name = document.getElementById('order-name')?.value || '';
    
    alert(`Teşekkürler Sayın ${name}!\n\n"${currentSelectedProduct}" için (${type}) sipariş talebiniz sistemimize iletildi. En kısa sürede sizinle iletişime geçeceğiz.`);
    closeMediaModal();
}

function toggleOrderNotice() {
    const type = document.getElementById('order-type')?.value;
    const box = document.getElementById('order-notice-box');
    if (box) {
        if (type && type.includes('Çizim')) {
            box.innerHTML = `<i class="fa-solid fa-shield-halved" style="color: #d4af37;"></i> <strong>Çizim & Kapora Bilgilendirmesi:</strong> 3D Çizim talepleriniz kaporası alındıktan sonra CAD ortamında sıfırdan çizilip onayınıza sunulur.`;
        } else {
            box.innerHTML = `<i class="fa-solid fa-hammer" style="color: #d4af37;"></i> <strong>Üretim & Teslimat Bilgilendirmesi:</strong> Gerçek döküm mücevher üretimleri 15 gün içinde atölyemizden şahsen teslim edilebilir veya sigortalı kargo ile gönderilir.`;
        }
    }
}

// Portföy Filtreleme
function initPortfolioFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    if (!filterButtons) return;
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Aktif buton stilini değiştir
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const filterValue = button.getAttribute('data-filter');
            const portfolioItems = document.querySelectorAll('.portfolio-item');
            
            portfolioItems.forEach(item => {
                const category = item.getAttribute('data-category');
                const tags = item.getAttribute('data-tags') || '';
                
                if (filterValue === 'all' || category === filterValue || tags.split(' ').includes(filterValue)) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 50);
                } else {
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 300);
                }
            });
        });
    });
}

// Sipariş Formu ve WhatsApp Entegrasyonu
function initCustomForm() {
    const form = document.getElementById('jewelry-request-form');
    const fileInput = document.getElementById('ref-upload');
    const uploadStatus = document.getElementById('upload-status-text');
    
    if (!form) return;
    
    if (fileInput && uploadStatus) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                uploadStatus.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color: #25d366;"></i> ${file.name} (${Math.round(file.size / 1024)} KB)`;
            } else {
                uploadStatus.textContent = 'Karalama veya İlham Görseli Seç';
            }
        });
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('user-name').value.trim();
        const phone = document.getElementById('user-phone').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const categorySelect = document.getElementById('jewelry-category');
        const category = categorySelect.options[categorySelect.selectedIndex].text;
        const budgetSelect = document.getElementById('budget-range');
        const budget = budgetSelect.options[budgetSelect.selectedIndex].text;
        const desc = document.getElementById('design-desc').value.trim();
        
        const whatsappNumber = '905320000000'; // Ern Tasarım telefon numarası buraya girilecek
        
        let message = `*KİTAP ERN TASARIM - YENİ ÇİZİM TALEBİ*\n`;
        message += `--------------------------------------\n`;
        message += `*Müşteri:* ${name}\n`;
        message += `*Telefon:* ${phone}\n`;
        message += `*E-posta:* ${email}\n`;
        message += `*Tasarım Türü:* ${category}\n`;
        message += `*Tahmini Bütçe:* ${budget}\n\n`;
        message += `*Tasarım Detayları & İstekleri:*\n`;
        message += `_"${desc}"_\n\n`;
        
        if (fileInput && fileInput.files.length > 0) {
            message += `*Not:* Müşteri bir referans görsel/çizim ekledi.`;
        }

        // Talebi LocalStorage'a kaydet (Admin panelde listelenmesi için)
        const requests = JSON.parse(localStorage.getItem('ern_jewelry_requests')) || [];
        const newRequest = {
            id: 'req_' + Date.now(),
            name,
            phone,
            email,
            category,
            budget,
            desc,
            date: new Date().toLocaleDateString('tr-TR'),
            status: 'Bekliyor'
        };
        requests.push(newRequest);
        localStorage.setItem('ern_jewelry_requests', JSON.stringify(requests));
        
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
        
        showSuccessNotification();
        
        setTimeout(() => {
            window.open(whatsappUrl, '_blank');
        }, 1500);
    });
}

function showSuccessNotification() {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '2rem';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.background = 'rgba(15, 18, 28, 0.95)';
    toast.style.border = '1px solid #d4af37';
    toast.style.color = '#ffffff';
    toast.style.padding = '1rem 2rem';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(212, 175, 55, 0.2)';
    toast.style.zIndex = '2000';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '0.75rem';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    
    toast.innerHTML = `
        <i class="fa-solid fa-circle-check" style="color: #d4af37; font-size: 1.25rem;"></i>
        <div>
            <strong style="display: block; font-family: 'Playfair Display', serif;">Talebiniz Hazırlandı</strong>
            <span style="font-size: 0.85rem; color: #9ca3af;">WhatsApp'a yönlendiriliyorsunuz...</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 100);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}
