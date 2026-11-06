"""Write data/most_read.json from Cloudflare page views over the last 30 days.

Uses the same filter as the dashboard's Visitors tab (HTML, status 200, eyeball
traffic) and sums views per page, counting sub-pages under each page's prefix.
Needs a CF_API_TOKEN with Zone Analytics Read; without it the file is left as is.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ZONE = "af97ea311917fd0c58cc914f9dd7e7ff"
DAYS = 30
TOP = 5
OUT = Path(__file__).resolve().parent.parent / "data" / "most_read.json"

PAGES = [
    ("/blog/video-index/", "Video-Index", "Which video benchmarks still test watching, and the 840 items that do"),
    ("/projects/interactionbench/", "InteractionBench", "Demo and leaderboard for real-time interaction on streaming video"),
    ("/VideoNSA-web/", "VideoNSA", "Learned native sparse attention that scales to long video"),
    ("/Video-MMLU-web/", "Video-MMLU", "A benchmark for knowledge-intensive lecture understanding"),
    ("/blog/phd-application/", "CS Ph.D. Application", "Notes and materials from my 2026 Fall application"),
]

QUERY = """
query ($zone: string, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
  viewer {
    zones(filter: {zoneTag: $zone}) {
      httpRequestsAdaptiveGroups(filter: $filter, limit: 200, orderBy: [count_DESC]) {
        count
        dimensions { clientRequestPath }
      }
    }
  }
}
"""


def main():
    token = os.environ.get("CF_API_TOKEN")
    if not token:
        print("CF_API_TOKEN not set; keeping", OUT)
        return 0
    end = datetime.now(timezone.utc).replace(microsecond=0)
    start = end - timedelta(days=DAYS)
    variables = {
        "zone": ZONE,
        "filter": {
            "datetime_geq": start.isoformat().replace("+00:00", "Z"),
            "datetime_lt": end.isoformat().replace("+00:00", "Z"),
            "AND": [
                {"edgeResponseStatus": 200},
                {"edgeResponseContentTypeName": "html"},
                {"requestSource": "eyeball"},
            ],
        },
    }
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql",
        data=json.dumps({"query": QUERY, "variables": variables}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.load(resp)
    if body.get("errors"):
        print(json.dumps(body["errors"], indent=2))
        return 1
    rows = body["data"]["viewer"]["zones"][0]["httpRequestsAdaptiveGroups"]
    views = {prefix: 0 for prefix, _, _ in PAGES}
    for row in rows:
        path = row["dimensions"]["clientRequestPath"]
        for prefix in views:
            if path.startswith(prefix):
                views[prefix] += row["count"]
                break
    items = [
        {"href": prefix, "title": title, "desc": desc, "views": views[prefix]}
        for prefix, title, desc in PAGES
    ]
    items.sort(key=lambda x: -x["views"])
    data = {"days": DAYS, "items": items[:TOP]}
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print(OUT, [(i["title"], i["views"]) for i in data["items"]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
