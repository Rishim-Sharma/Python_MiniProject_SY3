# SomaiyaSat: AI data router for a PocketQube

Mini project for the Python subject. Use case: KJS-SRS-01.

A Flask website where a small decision-tree "AI" (pure Python) chooses the order in
which a satellite sends TT&C, SSTV, Codec2 and M17 data during a short ground pass.
A watchdog rejects any order that does not put health data first.

## Run

    python -m venv venv
    venv\Scripts\activate          # Windows   (Mac/Linux: source venv/bin/activate)
    pip install -r requirements.txt
    python app.py

Open http://127.0.0.1:5000

## Files

    app.py            Flask routes: page, /api/schedule, /api/day
    scheduler.py      The AI logic: predict_order, watchdog, plan_pass, simulate_day
    templates/        index.html (Jinja)
    static/           style.css, app.js

## How it works

1. Browser sends link quality, battery, pass length and eclipse state to /api/schedule.
2. predict_order() (decision tree) returns an order of radio modes and a reason.
3. valid_order() (watchdog) checks it; if wrong, FIXED_ORDER is used instead.
4. plan_pass() fits each mode into the time and battery left and logs every decision.
5. /api/day runs six passes with a seeded random generator for the day chart.
