"""
=============================================================================
ERN TASARIM - MERKEZİ REKLAM VE DUYURU MODÜLÜ (PyQt5)
=============================================================================
Bu modülü yaptığınız tüm masaüstü programlarına (Çizim, Muhasebe, GoldHesap,
Namaz vb.) kolayca entegre edebilirsiniz.

Kullanım:
    from ern_reklam_modulu import ErnReklamKutusu, ErnBilgiBandi
    
    # 1. Reklam Kutusu Ekleme:
    self.reklam = ErnReklamKutusu(app_name="namaz", genislik=154, yukseklik=80)
    layout.addWidget(self.reklam)

    # 2. Kayan Bilgi/Duyuru Bandı Ekleme:
    self.band = ErnBilgiBandi(app_name="namaz")
    self.band.goster()
=============================================================================
"""

import os
import sys
import json
import webbrowser
import threading
import requests
from PyQt5.QtWidgets import (
    QWidget, QFrame, QVBoxLayout, QHBoxLayout, QLabel, 
    QApplication, QSizePolicy
)
from PyQt5.QtGui import QPixmap, QCursor, QFont, QColor
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QObject

try:
    from PyQt5.QtWebEngineWidgets import QWebEngineView
    from PyQt5.QtCore import QUrl
    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False


class ErnReklamServisi(QObject):
    veri_guncellendi = pyqtSignal(dict)
    API_URL = "https://www.erntasarim.com/data/reklamlar.json"

    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ErnReklamServisi()
        return cls._instance

    def __init__(self):
        super().__init__()
        self.veriler = {
            "genel": {
                "aktif": True,
                "baslik": "ERN TASARIM",
                "slogan": "Kişiye Özel Lüks Mücevher & 3D Çizim",
                "hedef_url": "https://www.erntasarim.com",
                "alt_bar_metni": "Ziyaret edin: www.erntasarim.com - Kişiye Özel Lüks Mücevher Tasarımı"
            }
        }
        self.yenile()

    def yenile(self):
        t = threading.Thread(target=self._indir, daemon=True)
        t.start()

    def _indir(self):
        try:
            r = requests.get(self.API_URL, timeout=8)
            if r.status_code == 200:
                self.veriler = r.json()
                self.veri_guncellendi.emit(self.veriler)
        except Exception:
            pass

    def get_reklam(self, app_name="genel"):
        prog = self.veriler.get("programlar", {})
        if app_name in prog and prog[app_name].get("aktif", True):
            return prog[app_name]
        return self.veriler.get("genel", {})

    def get_mesaj(self, app_name="genel"):
        rek = self.get_reklam(app_name)
        return rek.get("alt_bar_metni", "Ziyaret edin: www.erntasarim.com")

    def get_link(self, app_name="genel"):
        rek = self.get_reklam(app_name)
        return rek.get("hedef_url", "https://www.erntasarim.com")


class ErnReklamKutusu(QFrame):
    def __init__(self, app_name="genel", genislik=154, yukseklik=80, parent=None):
        super().__init__(parent)
        self.app_name = app_name
        self.setFixedSize(genislik, yukseklik)
        self.setCursor(QCursor(Qt.PointingHandCursor))
        
        self.servis = ErnReklamServisi.get_instance()
        self.servis.veri_guncellendi.connect(self.veriyi_guncelle)
        
        self.setStyleSheet("""
            ErnReklamKutusu {
                background-color: #06090e;
                border: 1px dashed #d4af37;
                border-radius: 10px;
            }
            ErnReklamKutusu:hover {
                border: 1.5px solid #ffd700;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(2, 2, 2, 2)
        layout.setSpacing(0)

        self.web_gorunumu = None
        
        if HAS_WEBENGINE:
            self.web_gorunumu = QWebEngineView(self)
            self.web_gorunumu.page().setBackgroundColor(Qt.transparent)
            self.web_gorunumu.page().settings().setAttribute(self.web_gorunumu.settings().ShowScrollBars, False)
            
            reklam_url = f"https://www.erntasarim.com/reklam?app={self.app_name}"
            self.web_gorunumu.load(QUrl(reklam_url))
            layout.addWidget(self.web_gorunumu)
        else:
            self.lbl_baslik = QLabel("💎 ERN TASARIM")
            self.lbl_baslik.setAlignment(Qt.AlignCenter)
            self.lbl_baslik.setStyleSheet("color: #ffd700; font-weight: bold; font-size: 11px; background: transparent;")

            self.lbl_slogan = QLabel("Kişiye Özel Lüks Mücevher")
            self.lbl_slogan.setAlignment(Qt.AlignCenter)
            self.lbl_slogan.setStyleSheet("color: #e2e8f0; font-size: 9px; background: transparent;")

            self.lbl_link = QLabel("www.erntasarim.com ➔")
            self.lbl_link.setAlignment(Qt.AlignCenter)
            self.lbl_link.setStyleSheet("color: #38bdf8; font-size: 8px; font-weight: bold; background: transparent;")

            layout.addWidget(self.lbl_baslik)
            layout.addWidget(self.lbl_slogan)
            layout.addWidget(self.lbl_link)

        self.veriyi_guncelle(self.servis.veriler)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            hedef = self.servis.get_link(self.app_name)
            webbrowser.open(hedef)

    def veriyi_guncelle(self, veriler):
        if not HAS_WEBENGINE:
            rek = self.servis.get_reklam(self.app_name)
            self.lbl_baslik.setText(f"💎 {rek.get('baslik', 'ERN TASARIM')}")
            self.lbl_slogan.setText(rek.get("slogan", "Özel Tasarım & 3D CAD"))


class ErnBilgiBandi(QWidget):
    def __init__(self, app_name="genel", parent=None):
        super().__init__(parent)
        self.app_name = app_name
        self.servis = ErnReklamServisi.get_instance()
        self.idx = 0
        self.mesajlar = []
        
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        self.container = QFrame(self)
        self.container.setFixedSize(300, 36)
        self.container.setStyleSheet("""
            QFrame {
                background-color: rgba(15, 23, 42, 220);
                border-radius: 8px;
                border: 1.5px solid rgba(212, 175, 55, 0.4);
            }
        """)
        
        layout = QHBoxLayout(self.container)
        layout.setContentsMargins(12, 0, 12, 0)
        
        self.lbl_icon = QLabel("📢")
        self.lbl_icon.setStyleSheet("font-size: 14px; background: transparent;")
        
        self.lbl_metin = QLabel()
        self.lbl_metin.setCursor(QCursor(Qt.PointingHandCursor))
        self.lbl_metin.setStyleSheet("color: #f8fafc; font-weight: bold; font-size: 11px; background: transparent;")
        
        layout.addWidget(self.lbl_icon)
        layout.addWidget(self.lbl_metin, 1)
        
        self.setFixedSize(300, 42)
        
        self.mesajlari_hazirla()
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.siradaki_mesaj)
        self.timer.start(5000)

    def mesajlari_hazirla(self):
        mesaj = self.servis.get_mesaj(self.app_name)
        self.mesajlar = [
            mesaj,
            "💎 ERN Tasarım: Kişiye Özel 3D Mücevher Sanatı",
            "🌐 Web sitemizi ziyaret edin: www.erntasarim.com"
        ]
        self.siradaki_mesaj()

    def siradaki_mesaj(self):
        if self.mesajlar:
            self.lbl_metin.setText(self.mesajlar[self.idx])
            self.idx = (self.idx + 1) % len(self.mesajlar)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            webbrowser.open(self.servis.get_link(self.app_name))

    def goster(self):
        screen = QApplication.primaryScreen().availableGeometry()
        self.move(screen.width() - 320, screen.height() - 45)
        self.show()


class ErnTelemetriServisi:
    """
    Tüm masaüstü programlarında (Çizim, Muhasebe, Namaz vb.)
    canlı kullanıcı ve şehir takibi (heartbeat) yapan arka plan servisi.
    """
    def __init__(self, app_name="namaz", sehir="İstanbul", interval_sec=300):
        self.app_name = app_name
        self.sehir = sehir
        self.interval_sec = interval_sec
        self.running = False
        self._thread = None
        self.device_id = None
        self._init_device_id()

    def _init_device_id(self):
        import uuid
        dev_file = os.path.join(os.environ.get("APPDATA", ""), "ERN_Tasarim", "device.id")
        try:
            os.makedirs(os.path.dirname(dev_file), exist_ok=True)
            if os.path.exists(dev_file):
                with open(dev_file, "r", encoding="utf-8") as f:
                    self.device_id = f.read().strip()
            if not self.device_id:
                self.device_id = str(uuid.uuid4())[:12]
                with open(dev_file, "w", encoding="utf-8") as f:
                    f.write(self.device_id)
        except:
            import uuid
            self.device_id = str(uuid.uuid4())[:12]

    def baslat(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def durdur(self):
        self.running = False

    def gonder(self):
        try:
            r = requests.get("https://www.erntasarim.com/data/reklamlar.json", timeout=5)
            if r.status_code != 200:
                return
            telemetri_url = r.json().get("telemetri_api_url", "")
            if not telemetri_url or not telemetri_url.startswith("http"):
                return
            
            payload = {
                "action": "ping",
                "app": self.app_name,
                "city": self.sehir,
                "device_id": self.device_id,
                "os": "Windows"
            }
            requests.post(telemetri_url, json=payload, timeout=6)
        except:
            pass

    def _loop(self):
        import time
        self.gonder()
        while self.running:
            for _ in range(self.interval_sec):
                if not self.running:
                    break
                time.sleep(1)
            if self.running:
                self.gonder()
