from flask import Flask, jsonify, request
import instaloader
import time
import requests
import random
from datetime import datetime, timedelta
from bs4 import BeautifulSoup  # Import BeautifulSoup
import json  # import json

app = Flask(__name__)

# --- Konfigurasi Proxy (DINAMIS) ---
PROXY_SOURCE_URL = 'https://www.free-proxy-list.net/'  # Contoh sumber proxy
#  PROXY_SOURCE_URL = 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all'
PROXY_REFRESH_INTERVAL = timedelta(minutes=30)  # Perbarui daftar proxy setiap 30 menit
proxies = []  # Daftar proxy (kosong pada awalnya)
last_proxy_refresh = datetime.min  # Waktu terakhir daftar proxy diperbarui

PROXY_RETRY_DELAY = 5  # Detik
MAX_PROXY_RETRIES = 5


# --- Konfigurasi Instaloader dan Caching ---
L = instaloader.Instaloader()
L.user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
CACHE_TTL = timedelta(minutes=15)
profile_cache = {}


def refresh_proxies():
    """Mengambil daftar proxy baru dari sumber online."""
    global proxies, last_proxy_refresh
    print("Refreshing proxy list...")
    try:
        response = requests.get(PROXY_SOURCE_URL, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table', id='proxylisttable') # Sesuaikan dengan struktur HTML sumber proxy
        if table:
          tbody = table.find('tbody')
          new_proxies = []
          for row in tbody.find_all('tr'):
              columns = row.find_all('td')
              if len(columns) >= 2 :
                ip = columns[0].text.strip()
                port = columns[1].text.strip()
                # Tambahkan proxy jika memenuhi kriteria (misalnya, HTTPS)
                # if columns[6].text.strip() == 'yes': # Contoh: Hanya proxy HTTPS
                new_proxies.append(f'http://{ip}:{port}')
          proxies = new_proxies
          last_proxy_refresh = datetime.utcnow()
          print(f"Found {len(proxies)} proxies.")
        else:
          print("Proxy table not found in the response.")

    except requests.exceptions.RequestException as e:
        print(f"Failed to refresh proxy list: {e}")
    except Exception as e:
        print("An error occurred", e)


def get_with_proxy(url):
    """Membuat request HTTP dengan rotating proxy (publik)."""
    global proxies, last_proxy_refresh

    # Perbarui daftar proxy jika sudah waktunya
    if datetime.utcnow() - last_proxy_refresh > PROXY_REFRESH_INTERVAL:
        refresh_proxies()

    # Jika tidak ada proxy yang tersedia, tunggu dan coba lagi
    if not proxies:
        print("No proxies available. Waiting...")
        time.sleep(PROXY_RETRY_DELAY * 2) #tunggu lebih lama
        refresh_proxies() #coba refresh lagi
        if not proxies: #jika masih kosong
             raise Exception("No proxies available after refresh")


    retries = 0
    while retries < MAX_PROXY_RETRIES:
        proxy = random.choice(proxies)
        proxies_dict = {'http': proxy, 'https': proxy}
        try:
            response = requests.get(url, proxies=proxies_dict, timeout=10)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed with proxy {proxy}: {e}")
            # Hapus proxy yang gagal dari daftar (opsional)
            if proxy in proxies:
                proxies.remove(proxy)
            retries += 1
            time.sleep(PROXY_RETRY_DELAY)
    raise Exception("All proxy attempts failed")


@app.route('/')
def index():
    return "Instagram Stalker Server is running!"

@app.route('/stalk/<username>')
def stalk_profile(username):
    # --- Caching ---
    if username in profile_cache:
        cached_data, cached_time = profile_cache[username]
        if datetime.utcnow() - cached_time < CACHE_TTL:
            print(f"Using cached data for {username}")
            return jsonify(cached_data)
        else:
            print(f"Cache expired for {username}. Fetching new data.")
    try:
        # 1. Gunakan requests (dengan proxy) untuk mendapatkan HTML
        profile_url = f"https://www.instagram.com/{username}/"
        response = get_with_proxy(profile_url)
        html_content = response.text

        # 2. Gunakan Instaloader untuk mem-parse HTML (trik)
        profile = instaloader.Profile.from_username(L.context, username) # Buat object profile
        profile._metadata = profile._obtain_metadata_string(html_content)  #Set metadata dari HTML, private method
        profile._full_metadata = True # Set sudah full metadata


        data = {
            "username": profile.username,
            "followers": profile.followers,
            "followees": profile.followees,
            "full_name": profile.full_name,
            "biography": profile.biography,
            "profile_pic_url": profile.profile_pic_url,
            "is_private": profile.is_private,
            "posts": []
        }
        #Post juga perlu di ambil manual pakai beautifulsoup, karena di ambil dari string
        soup = BeautifulSoup(html_content, 'html.parser')
        script_tags = soup.find_all('script', type='application/ld+json')

        for script_tag in script_tags:
          try:
            json_data = json.loads(script_tag.string)
            if 'itemListElement' in json_data: #ini adalah list post
              for item in json_data['itemListElement']:
                post_url = item['url']
                post_code = post_url.split('/')[-2]

                #Ambil data post (bisa juga di cache)
                #Harus pakai instaloader lagi, karena data caption, likes, comments itu ada di halaman terpisah.
                #Cara ini kurang efisien. Cara yang lebih efisien, pakai beautifulsoup lagi, cari di dalam JSON.
                temp_post = instaloader.Post.from_shortcode(L.context, post_code)

                post_data = {
                    "id": temp_post.shortcode,
                    "caption": temp_post.caption,
                    "likes": temp_post.likes,
                    "comments": temp_post.comments,
                    "date": temp_post.date_utc.isoformat(),
                    "url": temp_post.url,
                }
                data["posts"].append(post_data)
          except:
            pass
        profile_cache[username] = (data, datetime.utcnow())
        return jsonify(data)

    except instaloader.exceptions.ProfileNotExistsException:
        return jsonify({"error": "Profile not found"}), 404
    except requests.exceptions.RequestException:
        return jsonify({"error": "Failed to fetch profile page"}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")  # Log error
        return jsonify({"error": "An error occurred", "message": str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
