import os
import json
import imaplib
import smtplib
import email
from email.header import decode_header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from flask import Flask, request, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IS_VERCEL = bool(os.environ.get('VERCEL'))
DATA_DIR = '/tmp' if IS_VERCEL else os.path.join(BASE_DIR, 'data')
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except Exception:
    DATA_DIR = '/tmp'
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
    except Exception:
        pass

CONFIG_FILE = os.path.join(DATA_DIR, 'mail_settings.json')
CATALOG_FILE = os.path.join(DATA_DIR, 'catalog.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')
REQUESTS_FILE = os.path.join(DATA_DIR, 'requests.json')
REKLAMLAR_FILE = os.path.join(DATA_DIR, 'reklamlar.json')
CATEGORIES_FILE = os.path.join(DATA_DIR, 'categories.json')

DEFAULT_MAIL_CONFIG = {
    "imap_host": os.environ.get("IMAP_HOST", ""),
    "imap_port": int(os.environ.get("IMAP_PORT", 993)),
    "smtp_host": os.environ.get("SMTP_HOST", ""),
    "smtp_port": int(os.environ.get("SMTP_PORT", 465)),
    "mail_user": os.environ.get("MAIL_USER", "info@erntasarim.com"),
    "mail_pass": os.environ.get("MAIL_PASS", ""),
    "signature": os.environ.get("MAIL_SIGNATURE", "Saygılarımızla,\nERN Tasarım & Mücevherat Ekibi\nKapalıçarşı, İstanbul")
}

def load_mail_config():
    # Check primary config file
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                return {**DEFAULT_MAIL_CONFIG, **saved}
        except Exception:
            pass
    # Fallback to /tmp if not in data
    tmp_file = os.path.join('/tmp', 'mail_settings.json')
    if os.path.exists(tmp_file) and tmp_file != CONFIG_FILE:
        try:
            with open(tmp_file, 'r', encoding='utf-8') as f:
                saved = json.load(f)
                return {**DEFAULT_MAIL_CONFIG, **saved}
        except Exception:
            pass
    return DEFAULT_MAIL_CONFIG.copy()

def save_mail_config(data):
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        try:
            tmp_file = os.path.join('/tmp', 'mail_settings.json')
            with open(tmp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

def decode_mime_words(s):
    if not s:
        return ""
    try:
        decoded_fragments = decode_header(s)
        text = ""
        for frag, encoding in decoded_fragments:
            if isinstance(frag, bytes):
                text += frag.decode(encoding or 'utf-8', errors='ignore')
            else:
                text += str(frag)
        return text
    except Exception:
        return str(s)

app = Flask(__name__, static_folder='.', static_url_path='')

@app.after_request
def add_cache_control_headers(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# -------------------------------------------------------------
# 0. CATALOG & SETTINGS STORAGE APIs
# -------------------------------------------------------------
@app.route('/api/catalog', methods=['GET', 'POST'])
def handle_catalog():
    if request.method == 'GET':
        if os.path.exists(CATALOG_FILE):
            try:
                with open(CATALOG_FILE, 'r', encoding='utf-8') as f:
                    return jsonify(json.load(f))
            except Exception:
                pass
        return jsonify([])
    else:
        data = request.json or []
        try:
            with open(CATALOG_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'GET':
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                    return jsonify(json.load(f))
            except Exception:
                pass
        return jsonify({})
    else:
        data = request.json or {}
        try:
            with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/categories', methods=['GET', 'POST'])
def handle_categories():
    if request.method == 'GET':
        if os.path.exists(CATEGORIES_FILE):
            try:
                with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
                    return jsonify(json.load(f))
            except Exception:
                pass
        return jsonify([])
    else:
        data = request.json or []
        try:
            with open(CATEGORIES_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/requests', methods=['GET', 'POST'])
def handle_requests():
    if request.method == 'GET':
        if os.path.exists(REQUESTS_FILE):
            try:
                with open(REQUESTS_FILE, 'r', encoding='utf-8') as f:
                    return jsonify(json.load(f))
            except Exception:
                pass
        return jsonify([])
    else:
        data = request.json or []
        try:
            with open(REQUESTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/reklamlar', methods=['GET', 'POST'])
def handle_reklamlar():
    if request.method == 'GET':
        if os.path.exists(REKLAMLAR_FILE):
            try:
                with open(REKLAMLAR_FILE, 'r', encoding='utf-8') as f:
                    return jsonify(json.load(f))
            except Exception:
                pass
        return jsonify({})
    else:
        data = request.json or {}
        try:
            def _clean_url(u):
                if not u: return 'https://www.erntasarim.com'
                u = str(u).strip()
                if not u.startswith('http://') and not u.startswith('https://'):
                    return 'https://' + u
                return u

            if isinstance(data, dict):
                if 'genel' in data and isinstance(data['genel'], dict) and 'hedef_url' in data['genel']:
                    data['genel']['hedef_url'] = _clean_url(data['genel']['hedef_url'])
                if 'programlar' in data and isinstance(data['programlar'], dict):
                    for p in data['programlar'].values():
                        if isinstance(p, dict) and 'hedef_url' in p:
                            p['hedef_url'] = _clean_url(p['hedef_url'])

            with open(REKLAMLAR_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

# -------------------------------------------------------------
# 1. STATIC FILES SERVING
# -------------------------------------------------------------
@app.route('/')
def root():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    target = os.path.join(BASE_DIR, path)
    if os.path.exists(target) and os.path.isfile(target):
        return send_from_directory(BASE_DIR, path)
    return send_from_directory(BASE_DIR, 'index.html')

# -------------------------------------------------------------
# 2. MAIL CONFIG API
# -------------------------------------------------------------
@app.route('/api/mail/config', methods=['GET', 'POST'])
def handle_mail_config():
    if request.method == 'GET':
        cfg = load_mail_config()
        masked_pass = "••••••••" if cfg.get('mail_pass') else ""
        return jsonify({
            "success": True,
            "config": {
                **cfg,
                "has_pass": bool(cfg.get('mail_pass')),
                "mail_pass_masked": masked_pass
            }
        })
    else:
        data = request.json or {}
        cfg = load_mail_config()
        
        cfg['imap_host'] = data.get('imap_host', cfg.get('imap_host', '')).strip()
        cfg['imap_port'] = int(data.get('imap_port', cfg.get('imap_port', 993)))
        cfg['smtp_host'] = data.get('smtp_host', cfg.get('smtp_host', '')).strip()
        cfg['smtp_port'] = int(data.get('smtp_port', cfg.get('smtp_port', 465)))
        cfg['mail_user'] = data.get('mail_user', cfg.get('mail_user', '')).strip()
        cfg['signature'] = data.get('signature', cfg.get('signature', ''))
        
        new_pass = data.get('mail_pass', '')
        if new_pass and new_pass != "••••••••":
            cfg['mail_pass'] = new_pass
            
        save_mail_config(cfg)
        return jsonify({"success": True, "message": "E-Posta sunucu bağlantı ayarları kaydedildi!"})

# -------------------------------------------------------------
# 3. TEST CONNECTION API
# -------------------------------------------------------------
@app.route('/api/mail/test', methods=['POST'])
def test_mail_connection():
    data = request.json or {}
    cfg = load_mail_config()
    
    imap_host = data.get('imap_host') or cfg.get('imap_host')
    imap_port = int(data.get('imap_port') or cfg.get('imap_port') or 993)
    mail_user = data.get('mail_user') or cfg.get('mail_user')
    mail_pass = data.get('mail_pass') or cfg.get('mail_pass')

    if not imap_host or not mail_user or not mail_pass:
        return jsonify({"success": False, "message": "Lütfen IMAP Sunucu, E-Posta ve Şifre alanlarını eksiksiz girin."}), 400

    try:
        mail = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=8)
        mail.login(mail_user, mail_pass)
        mail.select('INBOX')
        status, counts = mail.search(None, 'ALL')
        total_msg = len(counts[0].split()) if status == 'OK' and counts[0] else 0
        mail.close()
        mail.logout()
        return jsonify({
            "success": True,
            "message": f"Bağlantı başarılı! Gelen kutusunda toplam {total_msg} e-posta tespit edildi.",
            "total_emails": total_msg
        })
    except imaplib.IMAP4.error as e:
        return jsonify({"success": False, "message": f"Giriş Başarısız: E-posta adresi veya şifre hatalı. ({str(e)})"}), 400
    except Exception as e:
        return jsonify({"success": False, "message": f"Sunucuya bağlanılamadı: {str(e)}"}), 500

# -------------------------------------------------------------
# 4. INBOX API (FETCH EMAILS - SAPANCA GİBİ)
# -------------------------------------------------------------
@app.route('/api/mail/inbox', methods=['GET'])
def get_inbox_emails():
    cfg = load_mail_config()
    imap_host = cfg.get('imap_host')
    imap_port = int(cfg.get('imap_port') or 993)
    mail_user = cfg.get('mail_user')
    mail_pass = cfg.get('mail_pass')

    if not imap_host or not mail_user or not mail_pass:
        return jsonify({
            "configured": False,
            "message": "IMAP e-posta sunucu bilgileri henüz tanımlanmamış.",
            "emails": []
        })

    try:
        mail = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=10)
        mail.login(mail_user, mail_pass)
        mail.select('INBOX')

        status, messages = mail.search(None, 'ALL')
        if status != 'OK' or not messages[0]:
            mail.logout()
            return jsonify({"configured": True, "emails": []})

        mail_ids = messages[0].split()
        recent_ids = mail_ids[-25:]
        recent_ids.reverse()

        email_list = []
        for mid in recent_ids:
            try:
                res, data = mail.fetch(mid, '(RFC822)')
                if res != 'OK' or not data:
                    continue
                
                raw_email = None
                for part in data:
                    if isinstance(part, tuple):
                        raw_email = part[1]
                        break
                
                if not raw_email:
                    continue

                msg = email.message_from_bytes(raw_email)
                subject = decode_mime_words(msg.get("Subject", "")) or "(Konu Yok)"
                from_addr = decode_mime_words(msg.get("From", "")) or "(Bilinmeyen)"
                date_str = msg.get("Date", "")

                body = ""
                if msg.is_multipart():
                    for p in msg.walk():
                        ctype = p.get_content_type()
                        disp = str(p.get("Content-Disposition"))
                        if ctype == "text/plain" and "attachment" not in disp:
                            try:
                                body = p.get_payload(decode=True).decode(p.get_content_charset() or 'utf-8', errors='ignore')
                                break
                            except Exception:
                                pass
                        elif ctype == "text/html" and not body and "attachment" not in disp:
                            try:
                                body = p.get_payload(decode=True).decode(p.get_content_charset() or 'utf-8', errors='ignore')
                            except Exception:
                                pass
                else:
                    try:
                        body = msg.get_payload(decode=True).decode(msg.get_content_charset() or 'utf-8', errors='ignore')
                    except Exception:
                        pass

                snippet = (body[:120] + '...') if len(body) > 120 else body

                email_list.append({
                    "id": mid.decode('utf-8', errors='ignore'),
                    "from": from_addr,
                    "subject": subject,
                    "date": date_str,
                    "body": body[:8000],
                    "snippet": snippet.strip()
                })
            except Exception as item_err:
                continue

        try:
            mail.close()
        except Exception:
            pass
        mail.logout()

        return jsonify({
            "configured": True,
            "success": True,
            "emails": email_list
        })
    except Exception as e:
        return jsonify({
            "configured": True,
            "success": False,
            "message": str(e),
            "emails": []
        }), 500

# -------------------------------------------------------------
# 5. SEND EMAIL API (REPLY & DIRECT - SAPANCA GİBİ)
# -------------------------------------------------------------
@app.route('/api/mail/send', methods=['POST'])
def send_email():
    cfg = load_mail_config()
    smtp_host = cfg.get('smtp_host') or cfg.get('imap_host', '').replace('imap.', 'smtp.')
    smtp_port = int(cfg.get('smtp_port') or 465)
    mail_user = cfg.get('mail_user')
    mail_pass = cfg.get('mail_pass')

    if not smtp_host or not mail_user or not mail_pass:
        return jsonify({"success": False, "message": "SMTP e-posta sunucu ayarları tanımlanmamış!"}), 400

    data = request.json or {}
    to_addr = data.get('to', '').strip()
    subject = data.get('subject', '').strip()
    body_text = data.get('body', '').strip()

    if not to_addr or not subject or not body_text:
        return jsonify({"success": False, "message": "Alıcı adresi, konu ve mesaj metni zorunludur."}), 400

    sig = cfg.get('signature', '')
    full_body = f"{body_text}\n\n--\n{sig}" if sig else body_text

    msg = MIMEMultipart()
    msg['From'] = f"ERN Tasarım <{mail_user}>"
    msg['To'] = to_addr
    msg['Subject'] = Header(subject, 'utf-8').encode()
    msg.attach(MIMEText(full_body, 'plain', 'utf-8'))

    try:
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, 465, timeout=10)
            server.login(mail_user, mail_pass)
            server.sendmail(mail_user, [to_addr], msg.as_string())
            server.quit()
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.starttls()
            server.login(mail_user, mail_pass)
            server.sendmail(mail_user, [to_addr], msg.as_string())
            server.quit()
        return jsonify({"success": True, "message": f"E-posta başarıyla {to_addr} adresine gönderildi!"})
    except Exception as e:
        try:
            alt_port = 587 if smtp_port == 465 else 465
            if alt_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, 465, timeout=10)
                server.login(mail_user, mail_pass)
                server.sendmail(mail_user, [to_addr], msg.as_string())
                server.quit()
            else:
                server = smtplib.SMTP(smtp_host, 587, timeout=10)
                server.starttls()
                server.login(mail_user, mail_pass)
                server.sendmail(mail_user, [to_addr], msg.as_string())
                server.quit()
            return jsonify({"success": True, "message": f"E-posta başarıyla {to_addr} adresine gönderildi!"})
        except Exception as e2:
            return jsonify({"success": False, "message": f"Mail Gönderim Hatası: {str(e2)}"}), 500

if __name__ == '__main__':
    print("==================================================")
    print("ERN TASARIM - Flask Backend & Mail Sunucusu")
    print("Port: 8085")
    print("Adres: http://localhost:8085")
    print("==================================================")
    app.run(host='0.0.0.0', port=8085, debug=False)
