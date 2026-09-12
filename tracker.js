/**
 * ERN TASARIM - Ziyaretçi Takip, Reklam ve Dinamik İçerik Motoru (tracker.js)
 * Sitedeki ziyaretleri, tıklamaları kaydeder ve panelden yönetilen reklam/duyuruları sayfalara uygular.
 */

(function() {
    // 1. ZİYARETÇİ VE SAYFA GÖRÜNTÜLENME TAKİBİ
    function trackPageView() {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const now = new Date().toLocaleString('tr-TR');
            const pagePath = window.location.pathname.split('/').pop() || 'index.html';

            // Tekil Ziyaretçi ID
            let visitorId = localStorage.getItem('ern_visitor_id');
            let isNewVisitor = false;
            if (!visitorId) {
                visitorId = 'vis_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                localStorage.setItem('ern_visitor_id', visitorId);
                isNewVisitor = true;
            }

            // Günlük Ziyaretçi Listesi
            let dailyVisitors = JSON.parse(localStorage.getItem('ern_daily_visitors') || '{}');
            if (!dailyVisitors[today]) {
                dailyVisitors[today] = { uniques: [], views: 0 };
            }
            if (!dailyVisitors[today].uniques.includes(visitorId)) {
                dailyVisitors[today].uniques.push(visitorId);
            }
            dailyVisitors[today].views += 1;

            // En fazla son 30 günü tut
            const days = Object.keys(dailyVisitors).sort();
            if (days.length > 30) {
                delete dailyVisitors[days[0]];
            }
            localStorage.setItem('ern_daily_visitors', JSON.stringify(dailyVisitors));

            // Toplam Görüntülenme Sayacı
            let totalViews = parseInt(localStorage.getItem('ern_total_views') || '0', 10) + 1;
            localStorage.setItem('ern_total_views', totalViews.toString());

            let totalUniques = parseInt(localStorage.getItem('ern_total_uniques') || '0', 10);
            if (isNewVisitor) {
                totalUniques += 1;
                localStorage.setItem('ern_total_uniques', totalUniques.toString());
            }

            // Sayfa Bazlı İstatistikler
            let pageStats = JSON.parse(localStorage.getItem('ern_page_stats') || '{}');
            pageStats[pagePath] = (pageStats[pagePath] || 0) + 1;
            localStorage.setItem('ern_page_stats', JSON.stringify(pageStats));

        } catch (e) {
            console.error('Takip hatası:', e);
        }
    }

    // 2. TIKLAMA VE DÖNÜŞÜM GÜNLÜĞÜ (WhatsApp, Satın Al, Sepet vb.)
    function logUserAction(actionName, extraInfo = '') {
        try {
            const pagePath = window.location.pathname.split('/').pop() || 'index.html';
            const logItem = {
                id: 'evt_' + Date.now(),
                timestamp: new Date().toLocaleString('tr-TR'),
                action: actionName,
                page: pagePath,
                extra: extraInfo,
                device: window.innerWidth < 768 ? 'Mobil 📱' : 'Masaüstü 💻'
            };

            let events = JSON.parse(localStorage.getItem('ern_analytics_events') || '[]');
            events.push(logItem);
            // Son 100 olayı sakla
            if (events.length > 100) events = events.slice(-100);
            localStorage.setItem('ern_analytics_events', JSON.stringify(events));
        } catch (e) {
            console.error('Olay günlüğü hatası:', e);
        }
    }

    // Tıklama Olay Dinleyicileri
    function initClickTracking() {
        document.addEventListener('click', function(e) {
            const target = e.target.closest('a, button');
            if (!target) return;

            const href = target.getAttribute('href') || '';
            const text = (target.textContent || '').trim();

            if (href.includes('wa.me') || target.classList.contains('whatsapp-float')) {
                logUserAction('WhatsApp Tıklaması', text || 'WhatsApp Butonu');
            } else if (target.id === 'btn-checkout' || text.includes('IBAN Ödemesine Geç')) {
                logUserAction('IBAN Ödeme Başlatma', 'Sepetten Ödeme Modalı Açıldı');
            } else if (target.classList.contains('btn-buy-stl') || text.includes('Sepete Ekle')) {
                logUserAction('Sepete Ekleme', text);
            } else if (target.classList.contains('copy-btn') || text.includes('Kopyala')) {
                logUserAction('IBAN Kopyalama', 'Banka IBAN panoya kopyalandı');
            } else if (text.includes('Benzerini Çizdir') || text.includes('Sipariş Ver')) {
                logUserAction('Sipariş Formu Tıklaması', text);
            }
        });
    }

    // 3. REKLAM VE DUYURU BANDI UYGULAMA (ADS & ANNOUNCEMENTS)
    function applyAdsAndAnnouncements() {
        try {
            const ads = JSON.parse(localStorage.getItem('ern_ads_settings') || '{}');

            // 3.1. Üst Duyuru Bandı (Announcement Bar)
            if (ads.announcementActive && ads.announcementText) {
                const bar = document.createElement('div');
                bar.id = 'ern-announcement-bar';
                bar.style.cssText = `
                    background: ${ads.announcementBg || 'linear-gradient(90deg, #aa820a, #d4af37)'};
                    color: ${ads.announcementColor || '#000000'};
                    padding: 9px 16px;
                    text-align: center;
                    font-size: 0.85rem;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    position: relative;
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                `;
                
                let linkHtml = ads.announcementLink 
                    ? `<a href="${ads.announcementLink}" style="color: inherit; text-decoration: underline; margin-left: 6px;">${ads.announcementBtnText || 'İncele →'}</a>` 
                    : '';

                bar.innerHTML = `
                    <span><i class="fa-solid fa-bullhorn" style="margin-right: 6px;"></i> ${ads.announcementText} ${linkHtml}</span>
                    <button onclick="document.getElementById('ern-announcement-bar').remove()" style="background:none; border:none; color:inherit; font-size:1.1rem; cursor:pointer; padding:0 6px; margin-left:auto; line-height:1;">&times;</button>
                `;

                document.body.prepend(bar);
            }

            // 3.2. Header Reklam / Banner Kodu
            if (ads.headerAdCode && ads.headerAdCode.trim()) {
                const header = document.querySelector('header');
                if (header) {
                    const adContainer = document.createElement('div');
                    adContainer.className = 'ern-header-ad-container';
                    adContainer.style.cssText = 'text-align: center; margin: 10px auto; max-width: 1200px; padding: 0 15px; overflow: hidden;';
                    adContainer.innerHTML = ads.headerAdCode;
                    header.after(adContainer);
                }
            }

            // 3.3. Footer Reklam / Banner Kodu
            if (ads.footerAdCode && ads.footerAdCode.trim()) {
                const footer = document.querySelector('footer');
                if (footer) {
                    const adContainer = document.createElement('div');
                    adContainer.className = 'ern-footer-ad-container';
                    adContainer.style.cssText = 'text-align: center; margin: 20px auto; max-width: 1200px; padding: 0 15px; overflow: hidden;';
                    adContainer.innerHTML = ads.footerAdCode;
                    footer.before(adContainer);
                }
            }

            // 3.4. Google Analytics & Pixel Kodları
            if (ads.googleAnalyticsId && !document.getElementById('ga-script')) {
                const ga = document.createElement('script');
                ga.id = 'ga-script';
                ga.async = true;
                ga.src = `https://www.googletagmanager.com/gtag/js?id=${ads.googleAnalyticsId}`;
                document.head.appendChild(ga);

                const gaInit = document.createElement('script');
                gaInit.innerHTML = `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${ads.googleAnalyticsId}');
                `;
                document.head.appendChild(gaInit);
            }

            if (ads.metaPixelId && !document.getElementById('meta-pixel-script')) {
                const pixel = document.createElement('script');
                pixel.id = 'meta-pixel-script';
                pixel.innerHTML = `
                    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
                    document,'script','https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', '${ads.metaPixelId}');
                    fbq('track', 'PageView');
                `;
                document.head.appendChild(pixel);
            }

        } catch (e) {
            console.error('Reklam uygulama hatası:', e);
        }
    }

    // 4. DİNAMİK SİTE İÇERİĞİ UYGULAMA (CMS METİNLERİ)
    function applyDynamicContent() {
        try {
            const cms = JSON.parse(localStorage.getItem('ern_site_content') || '{}');
            const pagePath = window.location.pathname.split('/').pop() || 'index.html';

            // Ana Sayfa Hero Başlığı ve Alt Yazısı
            if (pagePath === 'index.html' || pagePath === '') {
                if (cms.homeHeroTitle) {
                    const heroH1 = document.querySelector('.hero h1');
                    if (heroH1) heroH1.textContent = cms.homeHeroTitle;
                }
                if (cms.homeHeroSubtitle) {
                    const heroP = document.querySelector('.hero p');
                    if (heroP) heroP.textContent = cms.homeHeroSubtitle;
                }
            }

            // STL Mağazası Başlığı
            if (pagePath === 'magaza.html') {
                if (cms.shopHeroTitle) {
                    const shopH1 = document.querySelector('.shop-hero h1');
                    if (shopH1) shopH1.textContent = cms.shopHeroTitle;
                }
                if (cms.shopHeroSubtitle) {
                    const shopP = document.querySelector('.shop-hero p');
                    if (shopP) shopP.textContent = cms.shopHeroSubtitle;
                }
            }

            // Sıkça Sorulan Sorular (SSS) Dinamik Render
            if (cms.faqs && Array.isArray(cms.faqs) && cms.faqs.length > 0) {
                const faqContainer = document.querySelector('.faq-list') || document.querySelector('.faq-grid');
                if (faqContainer) {
                    faqContainer.innerHTML = cms.faqs.map(item => `
                        <details class="faq-item" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; cursor: pointer;">
                            <summary style="font-family: var(--font-serif); font-size: 1.1rem; font-weight: 600; color: var(--gold-primary); display: flex; justify-content: space-between; align-items: center; list-style: none;">
                                <span>${item.q}</span>
                                <i class="fa-solid fa-chevron-down" style="font-size: 0.85rem;"></i>
                            </summary>
                            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border-light); line-height: 1.5;">
                                ${item.a}
                            </p>
                        </details>
                    `).join('');
                }
            }

        } catch (e) {
            console.error('İçerik uygulama hatası:', e);
        }
    }

    // 5. GİZLİ YÖNETİCİ GİRİŞİ: LOGOYA 5 SANİYE BASILI TUTMA (TAMAMEN GİZLİ & SESSİZ)
    function initAdminSecretHoldTrigger() {
        const targets = document.querySelectorAll('.logo, .footer-logo, header a[href="index.html"]');
        if (!targets || targets.length === 0) return;

        let holdTimer = null;
        let triggered = false;

        function startHold() {
            triggered = false;
            holdTimer = setTimeout(() => {
                triggered = true;
                if (navigator.vibrate) {
                    try { navigator.vibrate(80); } catch(err) {}
                }
                window.location.href = 'yonetici.html';
            }, 5000);
        }

        function cancelHold() {
            if (!triggered) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        }

        targets.forEach(target => {
            target.addEventListener('mousedown', startHold);
            target.addEventListener('mouseup', cancelHold);
            target.addEventListener('mouseleave', cancelHold);

            target.addEventListener('touchstart', startHold, { passive: true });
            target.addEventListener('touchend', cancelHold);
            target.addEventListener('touchcancel', cancelHold);

            target.addEventListener('click', (e) => {
                if (triggered) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        });
    }

    // 6. WHATSAPP NUMARA GİZLEME, MASKELİ VİTRİN GÖRÜNÜMÜ VE GÜVENLİ YÖNLENDİRME
    function applyWhatsAppPrivacy() {
        try {
            const settings = JSON.parse(localStorage.getItem('ern_site_settings') || '{}');
            const realNumber = (settings.whatsapp || '905320000000').replace(/[^0-9]/g, '');
            const displayNumber = settings.whatsappDisplay || '+90 (532) 000 00 00';
            const isHideActive = settings.whatsappHide !== false;

            // 6.1. Sitedeki Görünen Buton ve Kart Metinlerini Güncelle
            document.querySelectorAll('.pill-wa').forEach(el => {
                el.innerHTML = `<i class="fa-brands fa-whatsapp" style="font-size: 1.2rem;"></i> WhatsApp (${displayNumber})`;
            });

            document.querySelectorAll('.wa-display-number').forEach(el => {
                el.textContent = displayNumber;
            });

            // Sayfa genelindeki vitrin telefon metinlerini güncelle (+90 532 000 00 00 veya benzeri)
            try {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                const nodesToReplace = [];
                while (node = walker.nextNode()) {
                    const val = node.nodeValue;
                    if (val && (val.includes('+90 532 000 00 00') || val.includes('+90 (532) 000 00 00') || val.includes('0532 000 00 00'))) {
                        const parent = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
                        if (parent !== 'script' && parent !== 'style' && parent !== 'textarea' && parent !== 'input') {
                            nodesToReplace.push(node);
                        }
                    }
                }
                nodesToReplace.forEach(n => {
                    n.nodeValue = n.nodeValue
                        .replace(/\+90\s?\(?532\)?\s?000\s?00\s?00/g, displayNumber)
                        .replace(/0532\s?000\s?00\s?00/g, displayNumber);
                });
            } catch (err) {
                console.warn('Metin değiştirme hatası:', err);
            }

            // 6.2. Kaynak Kodda Gerçek Numarayı Maskele & Güvenli Tıklama Yönlendirmesi Kur
            if (isHideActive) {
                const waElements = document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp.com"], a.whatsapp-float, a.pill-wa, .btn-whatsapp-submit');
                waElements.forEach(el => {
                    const originalHref = el.getAttribute('href') || '';

                    // Hazır mesajı yakala
                    let message = el.getAttribute('data-ern-wa-msg');
                    if (!message && originalHref) {
                        try {
                            if (originalHref.includes('text=')) {
                                const splitText = originalHref.split('text=')[1];
                                message = decodeURIComponent(splitText.split('&')[0]);
                            }
                        } catch(e) {}
                    }
                    if (!message) {
                        message = 'Merhaba ERN Tasarım, bilgi almak istiyorum.';
                    }

                    // Maskele: href'ten gerçek numarayı kaldır
                    el.setAttribute('data-ern-wa-msg', message);
                    el.setAttribute('href', 'javascript:void(0);');
                    el.setAttribute('rel', 'nofollow');
                    el.removeAttribute('target');

                    // Tıklama olayını güvenli yönlendiriciye bağla
                    if (!el.hasAttribute('data-wa-protected')) {
                        el.setAttribute('data-wa-protected', 'true');
                        el.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();

                            // 1. KÖTÜ AMAÇLI KULLANIM ÖNLEMİ: Otomatik Bot Tıklama Kontrolü
                            // Gerçek insan etkileşimlerinde e.isTrusted daima true olur.
                            // Eğer yapay/programatik bir bot scripti ise (dispatch/click()) bloke et.
                            if (e.isTrusted === false) {
                                logUserAction('Bot Tıklaması Engellendi', 'Programatik Script Girişimi');
                                return;
                            }

                            // 2. KÖTÜ AMAÇLI KULLANIM ÖNLEMİ: Flood / Seri Tıklama Engeli (Cooldown 3.5 sn)
                            const now = Date.now();
                            const lastClick = parseInt(sessionStorage.getItem('ern_wa_click_cooldown') || '0', 10);
                            if (now - lastClick < 3500) {
                                showSecurityNotice('🛡️ Güvenlik Kalkanı: Lütfen tekrar tıklamadan önce birkaç saniye bekleyin.');
                                logUserAction('WhatsApp Flood Engellendi', 'Aralık: ' + (now - lastClick) + 'ms');
                                return;
                            }
                            sessionStorage.setItem('ern_wa_click_cooldown', now.toString());

                            const currentSettings = JSON.parse(localStorage.getItem('ern_site_settings') || '{}');
                            const targetReal = (currentSettings.whatsapp || realNumber || '905320000000').replace(/[^0-9]/g, '');
                            const msgToSend = this.getAttribute('data-ern-wa-msg') || 'Merhaba ERN Tasarım, bilgi almak istiyorum.';
                            const finalUrl = `https://api.whatsapp.com/send?phone=${targetReal}&text=${encodeURIComponent(msgToSend)}`;

                            window.open(finalUrl, '_blank');
                            logUserAction('WhatsApp Tıklaması (Korumalı Yönlendirme)', 'Vitrin: ' + displayNumber);
                        });
                    }
                });
            }
        } catch (e) {
            console.error('WhatsApp gizlilik motoru hatası:', e);
        }
    }

    // Güvenlik bilgilendirme tostu (Kötü amaçlı seri tıklamada uyarır)
    function showSecurityNotice(msg) {
        let toast = document.getElementById('ern-security-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ern-security-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: linear-gradient(135deg, #1e1b4b 0%, #0b1120 100%);
                border: 1px solid #6366f1;
                color: #e0e7ff;
                padding: 12px 24px;
                border-radius: 12px;
                font-size: 0.88rem;
                font-weight: 600;
                z-index: 9999999;
                box-shadow: 0 10px 30px rgba(0,0,0,0.7);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex;
                align-items: center;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(100px)';
        }, 3000);
    }

    // Harici scriptlerden ve formlardan doğrudan gizli yönlendirme tetikleyicisi
    window.openErnWhatsApp = function(customMsg) {
        try {
            const currentSettings = JSON.parse(localStorage.getItem('ern_site_settings') || '{}');
            const targetReal = (currentSettings.whatsapp || '905320000000').replace(/[^0-9]/g, '');
            const msgToSend = customMsg || 'Merhaba ERN Tasarım, bilgi almak istiyorum.';
            const finalUrl = `https://api.whatsapp.com/send?phone=${targetReal}&text=${encodeURIComponent(msgToSend)}`;
            window.open(finalUrl, '_blank');
        } catch(e) {
            window.open('https://api.whatsapp.com/send?phone=905320000000', '_blank');
        }
    };

    // SAYFA YÜKLENDİĞİNDE BAŞLAT
    function initTracker() {
        trackPageView();
        initClickTracking();
        applyAdsAndAnnouncements();
        applyDynamicContent();
        applyWhatsAppPrivacy();
        initAdminSecretHoldTrigger();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }
})();
