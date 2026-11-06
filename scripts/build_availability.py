"""Write data/availability.json from the public free/busy calendar feed.

Only busy intervals inside working hours are kept, as minutes since
midnight Eastern Time, so no event details ever reach the site.
"""
import json
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

FEED = "https://calendar.google.com/calendar/ical/enxinson%40engineering.upenn.edu/public/basic.ics"
TZ = ZoneInfo("America/New_York")
DAY_START, DAY_END = 9 * 60, 18 * 60
WEEKS = 3
OUT = Path(__file__).resolve().parent.parent / "data" / "availability.json"


def parse_time(value, params):
    if "VALUE=DATE" in params or len(value) == 8:
        return datetime.strptime(value[:8], "%Y%m%d").replace(tzinfo=TZ)
    if value.endswith("Z"):
        return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    tzid = next((p.split("=", 1)[1] for p in params if p.startswith("TZID=")), "America/New_York")
    return datetime.strptime(value, "%Y%m%dT%H%M%S").replace(tzinfo=ZoneInfo(tzid))


def events(text):
    lines = []
    for raw in text.splitlines():
        if raw.startswith((" ", "\t")) and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    current = None
    for line in lines:
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT" and current is not None:
            yield current
            current = None
        elif current is not None and ":" in line:
            key, value = line.split(":", 1)
            name, *params = key.split(";")
            current[name] = (value, params)


def main():
    with urllib.request.urlopen(FEED, timeout=30) as resp:
        text = resp.read().decode("utf-8")
    today = datetime.now(TZ).date()
    first = today - timedelta(days=today.weekday())
    last = first + timedelta(weeks=WEEKS)
    busy = {}
    for ev in events(text):
        if "DTSTART" not in ev or ev.get("TRANSP", ("",))[0] == "TRANSPARENT" or ev.get("STATUS", ("",))[0] == "CANCELLED":
            continue
        start = parse_time(*ev["DTSTART"]).astimezone(TZ)
        end = parse_time(*ev["DTEND"]).astimezone(TZ) if "DTEND" in ev else start + timedelta(days=1)
        day = start.date()
        while day < last and datetime.combine(day, datetime.min.time(), TZ) < end:
            if day >= first:
                day_start = datetime.combine(day, datetime.min.time(), TZ)
                a = max(DAY_START, int((start - day_start).total_seconds() // 60))
                b = min(DAY_END, int((end - day_start).total_seconds() // 60 + 0.999))
                if a < b:
                    busy.setdefault(day.isoformat(), []).append([a, b])
            day += timedelta(days=1)
    for key, spans in busy.items():
        spans.sort()
        merged = [spans[0]]
        for a, b in spans[1:]:
            if a <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], b)
            else:
                merged.append([a, b])
        busy[key] = merged
    data = {
        "tz": "America/New_York",
        "from": first.isoformat(),
        "weeks": WEEKS,
        "day": [DAY_START, DAY_END],
        "busy": dict(sorted(busy.items())),
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(f"{OUT}: {sum(len(v) for v in busy.values())} busy spans from {first}")


if __name__ == "__main__":
    sys.exit(main())
