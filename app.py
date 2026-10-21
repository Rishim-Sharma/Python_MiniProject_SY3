"""SomaiyaSat: AI data router for a PocketQube. Run with:  python app.py"""
import random

from flask import Flask, jsonify, render_template, request

from scheduler import FIXED_ORDER, MODES, plan_pass, simulate_day

app = Flask(__name__, static_folder = "public/static", static_url_path = "/static")


def number(name, default, low, high):
    """Read a numeric query parameter and keep it inside a safe range."""
    try:
        value = float(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    return max(low, min(high, value))


@app.route("/")
def index():
    return render_template("index.html", modes=[MODES[m] for m in FIXED_ORDER])


@app.get("/api/schedule")
def api_schedule():
    result = plan_pass(
        link=int(number("link", 75, 5, 100)),
        battery=int(number("battery", 80, 5, 100)),
        minutes=number("minutes", 8, 2, 12),
        eclipse=request.args.get("eclipse") == "1",
        fault=request.args.get("fault") == "1",
    )
    return jsonify(result)


@app.get("/api/day")
def api_day():
    seed = int(number("seed", random.randint(1, 9999), 1, 999999))
    return jsonify(simulate_day(seed))


if __name__ == "__main__":
    app.run(debug=True)
