"""
Scheduler logic for SomaiyaSat (use case KJS-SRS-01).

A small decision tree looks at link quality, battery and eclipse state and
proposes an order for the four radio modes. A watchdog checks that proposal and
falls back to a fixed rule-based order if it breaks the safety rule
(TT&C / health data must always go first).
"""
import random

MODES = {
    "ttc": {
        "id": "ttc", "name": "TT&C", "full": "Telemetry and housekeeping",
        "carries": "Satellite health, temperature, battery level and commands from the ground.",
        "base": 20, "power": 1, "min_link": 10, "kb": 1, "cost": "Very low",
    },
    "sstv": {
        "id": "sstv", "name": "SSTV", "full": "Slow-scan TV images",
        "carries": "Pictures from the onboard camera, sent as slow-scan television.",
        "base": 110, "power": 6, "min_link": 50, "kb": 40, "cost": "High",
    },
    "codec2": {
        "id": "codec2", "name": "Codec2", "full": "Compressed digital voice",
        "carries": "Low-bitrate digital voice for amateur radio users.",
        "base": 60, "power": 3, "min_link": 30, "kb": 12, "cost": "Medium",
    },
    "m17": {
        "id": "m17", "name": "M17", "full": "Digital voice and data",
        "carries": "Digital voice and data for the ham radio community.",
        "base": 90, "power": 4, "min_link": 40, "kb": 20, "cost": "Medium to high",
    },
}

FIXED_ORDER = ["ttc", "sstv", "codec2", "m17"]


def seconds_needed(mode, link):
    """A weak link means retries, so the same data takes longer."""
    return round(mode["base"] * (1 + (100 - link) / 50))


def predict_order(link, battery, eclipse):
    """The 'AI': a tiny decision tree small enough for a microcontroller."""
    if battery < 20:
        return ["ttc", "codec2", "m17", "sstv"], "Battery is very low, so cheap modes go first."
    if link < 35:
        return ["ttc", "codec2", "m17", "sstv"], "Link is weak, so low-bandwidth modes go first."
    if link >= 70 and battery >= 50 and not eclipse:
        return ["ttc", "sstv", "m17", "codec2"], "Clear link and good battery, so images go early."
    if eclipse or battery < 45:
        return ["ttc", "codec2", "m17", "sstv"], "Power is tight, so images wait."
    return list(FIXED_ORDER), "Normal conditions, so the default order is used."


def valid_order(order):
    """Watchdog check: every mode exactly once, and TT&C first."""
    return sorted(order) == sorted(MODES) and order[0] == "ttc"


def _entry(kind, label, text):
    return {"kind": kind, "label": label, "text": text}


def plan_pass(link, battery, minutes, eclipse=False, fault=False):
    total = int(minutes * 60)
    reserve = 35 if eclipse else 20
    spare = max(0, battery - reserve)
    power_left, time_left = spare, total
    safe = battery < 20
    log = []

    order, reason = predict_order(link, battery, eclipse)
    if fault:
        order, reason = ["sstv", "m17", "codec2", "ttc"], "Faulty output injected for the demo."
    ai_order = list(order)

    fallback = not valid_order(order)
    if fallback:
        log.append(_entry("alert", "Watchdog",
                          "AI output put TT&C last. Switched to the fixed rule-based order."))
        order = list(FIXED_ORDER)
    if safe:
        log.append(_entry("alert", "Safe mode", "Battery is below 20%, so only TT&C is allowed."))

    segments, cursor = [], 0
    for mid in order:
        m = MODES[mid]
        t = seconds_needed(m, link)

        if mid == "ttc":  # health data is always sent, even with no spare power
            t = min(t, time_left)
            segments.append({"id": mid, "start": cursor, "seconds": t, "kb": m["kb"]})
            cursor += t
            time_left -= t
            power_left = max(0, power_left - m["power"])
            log.append(_entry("sent", m["name"], f"Sent in {t} s. Health data always goes first."))
            continue

        why = None
        if safe:
            why = "Safe mode is on."
        elif link < m["min_link"]:
            why = f"Link is {link}%, this mode needs {m['min_link']}%."
        elif t > time_left:
            why = f"Needs {t} s, only {time_left} s left."
        elif m["power"] > power_left:
            why = f"Needs {m['power']}% battery, only {power_left}% spare."
        if why:
            log.append(_entry("held", m["name"], f"Held for a later pass. {why}"))
            continue

        segments.append({"id": mid, "start": cursor, "seconds": t, "kb": m["kb"]})
        cursor += t
        time_left -= t
        power_left -= m["power"]
        log.append(_entry("sent", m["name"], f"Sent in {t} s, used {m['power']}% battery."))

    sent = len(segments)
    if safe:
        status, tone = "Safe mode", "bad"
    elif sent == len(MODES):
        status, tone = "All data sent", "ok"
    elif sent == 1:
        status, tone = "Health data only", "bad"
    else:
        status, tone = f"{sent} of {len(MODES)} modes sent", "warn"

    return {
        "status": status, "tone": tone, "reason": reason,
        "ai_order": ai_order, "order": order, "fallback": fallback, "safe": safe,
        "total": total, "used": total - time_left, "reserve": reserve,
        "battery_used": spare - power_left,
        "kb": sum(s["kb"] for s in segments),
        "segments": segments, "log": log,
    }


def simulate_day(seed, passes=6):
    """A repeatable made-up day: sunlit passes charge the battery, eclipse passes drain it."""
    rng = random.Random(seed)
    battery = rng.randint(55, 90)
    out = []
    for i in range(passes):
        link = rng.randint(20, 98)
        minutes = rng.randint(3, 11)
        eclipse = rng.random() < 0.35
        fault = rng.random() < 0.12
        res = plan_pass(link, battery, minutes, eclipse, fault)
        out.append({
            "n": i + 1, "link": link, "battery": battery, "minutes": minutes,
            "eclipse": eclipse, "fault": fault, "status": res["status"], "tone": res["tone"],
            "kb": res["kb"], "by_mode": {s["id"]: s["kb"] for s in res["segments"]},
        })
        swing = -rng.randint(6, 16) if eclipse else rng.randint(4, 12)
        battery = max(6, min(100, battery - res["battery_used"] + swing))
    return {"seed": seed, "passes": out, "total_kb": sum(p["kb"] for p in out)}
