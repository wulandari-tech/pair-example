from flask import Flask, jsonify, request
import instaloader
import time
from datetime import datetime, timedelta

app = Flask(__name__)
L = instaloader.Instaloader()

# --- Konfigurasi ---
CACHE_TTL = timedelta(minutes=15)  # Waktu kadaluarsa cache (15 menit)
RETRY_DELAY = 60  # Waktu tunggu sebelum mencoba lagi setelah 401 (detik)
MAX_RETRIES = 3  # Jumlah maksimum percobaan ulang setelah 401


# In-memory cache (gunakan Redis atau database lain untuk solusi yang lebih scalable)
profile_cache = {}


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

    # --- Rate Limiting & Retry Logic ---
    retries = 0
    while retries < MAX_RETRIES:
        try:
            profile = instaloader.Profile.from_username(L.context, username)

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

            for post in profile.get_posts():
                post_data = {
                    "id": post.shortcode,
                    "caption": post.caption,
                    "likes": post.likes,
                    "comments": post.comments,
                    "date": post.date_utc.isoformat(),
                    "url": post.url,
                }
                data["posts"].append(post_data)
            # Simpan ke cache
            profile_cache[username] = (data, datetime.utcnow())
            return jsonify(data)

        except instaloader.exceptions.ProfileNotExistsException:
            return jsonify({"error": "Profile not found"}), 404

        except instaloader.exceptions.TooManyRequestsException as e:  #Tangani 401/429
            print(f"Rate limited for {username}.  Retrying in {RETRY_DELAY} seconds... ({retries + 1}/{MAX_RETRIES})")
            retries += 1
            time.sleep(RETRY_DELAY)
        except Exception as e:
            return jsonify({"error": "An error occurred", "message": str(e)}), 500

    # Jika mencapai batas percobaan ulang
    return jsonify({"error": "Too many requests", "message": "Failed to fetch data after multiple retries."}), 429


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
