from flask import Flask, jsonify, request, send_from_directory
import instaloader
import os
from dotenv import load_dotenv

load_dotenv()  # Muat variabel lingkungan dari .env

app = Flask(__name__)
L = instaloader.Instaloader()

# (Opsional) Login jika diperlukan untuk mengakses data privat
# L.login(os.getenv("INSTAGRAM_USERNAME"), os.getenv("INSTAGRAM_PASSWORD"))

@app.route('/')
def index():
    return "Instagram Stalker Server is running!"

@app.route('/stalk/<username>')
def stalk_profile(username):
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
        return jsonify(data)


    except instaloader.exceptions.ProfileNotExistsException:
        return jsonify({"error": "Profile not found"}), 404
    except Exception as e:
        return jsonify({"error": "An error occurred", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000))) # Gunakan port dari .env atau default ke 5000
