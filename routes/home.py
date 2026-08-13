"""Home route - serves the marketing home and dashboard pages."""

from flask import Blueprint, render_template

from routes.auth import get_current_user

home_bp = Blueprint("home", __name__)


@home_bp.route("/")
def index():
    """Professional marketing home page."""
    return render_template("home.html", current_user=get_current_user())


@home_bp.route("/studio")
def studio_hub():
    """Unified studio hub - navigation center for all modules."""
    user = get_current_user()
    return render_template("studio_hub.html", current_user=user)


@home_bp.route("/yt-downloader")
def youtube_downloader():
    """Dedicated YouTube downloader page."""
    return render_template("yt_downloader.html", current_user=get_current_user())


@home_bp.route("/dashboard")
def dashboard():
    """Main dashboard/wizard page (auth protected)."""
    user = get_current_user()
    if not user:
        return render_template("index.html", current_user=None, auth_required=True)
    return render_template("index.html", current_user=user, auth_required=False)


@home_bp.route("/guide")
def guide():
    """Professional user guide for AI Spark Studio."""
    return render_template("guide.html", current_user=get_current_user())


@home_bp.route("/youtube-desk")
def youtube_desk():
    """YouTube Automation Desk page."""
    user = get_current_user()
    if not user:
        return render_template("youtube_desk.html", current_user=None, auth_required=True)
    return render_template("youtube_desk.html", current_user=user, auth_required=False)
