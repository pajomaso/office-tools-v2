#!/usr/bin/env python3
"""
Checks the running app against the v2 spec, section by section, and prints PASS / FAIL for each item.

  1. Start the API and (optionally) the UI as usual (see CLAUDE.md).
  2. python3 scripts/spec-check.py

It RESETS the local fake data first (pnpm run seed:v2) and then creates more fake data, so it only runs against
localhost. Set NO_SEED=1 to skip the reset. Set API_URL if the API isn't on http://localhost:8080.
Set CHECK_DATABASE_URL to a local Postgres URL to also verify that tokens are stored hashed.
Exit code is 1 if anything FAILED.
"""
import datetime as dt
import http.cookiejar
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

BASE = os.environ.get("API_URL", "http://localhost:8080").rstrip("/")
if urlparse(BASE).hostname not in ("localhost", "127.0.0.1", "::1"):
    sys.exit(f"Refusing to run: API_URL is {BASE}. This script creates fake data and only runs against localhost.")
API = BASE + "/api/portal"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── tiny HTTP client with its own cookie jar (one per signed-in person) ─────
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


class Resp:
    def __init__(self, status, headers, body):
        self.status, self.headers, self.body = status, headers, body
        try:
            self.json = json.loads(body)
        except Exception:
            self.json = None


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), _NoRedirect())

    def call(self, method, path, body=None, raw=None):
        data, headers = None, {}
        if body is not None:
            data, headers["content-type"] = json.dumps(body).encode(), "application/json"
        if raw:
            data, headers["content-type"] = raw
        req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
        try:
            r = self.opener.open(req)
            return Resp(r.status, r.headers, r.read())
        except urllib.error.HTTPError as e:
            return Resp(e.code, e.headers, e.read())

    get = lambda self, p: self.call("GET", p)
    post = lambda self, p, b=None: self.call("POST", p, b if b is not None else {})
    put = lambda self, p, b=None: self.call("PUT", p, b if b is not None else {})
    patch = lambda self, p, b=None: self.call("PATCH", p, b if b is not None else {})
    delete = lambda self, p: self.call("DELETE", p)


def login(email):
    c = Client()
    r = c.post("/auth/request", {"email": email, "origin": BASE})
    link = (r.json or {}).get("devLink")
    if not link:
        sys.exit(f"Could not sign in as {email}: {r.status} {r.body[:120]!r}. Is the API running in development mode with the seed loaded?")
    c.call("GET", link[len(API):])  # the sign-in link sets the session cookie
    return c


def multipart(fields, file_field, filename, content, ctype):
    boundary = "----speccheck" + os.urandom(6).hex()
    parts = []
    for k, v in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + content + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


# ── results ─────────────────────────────────────────────────────────────────
results = []
section = ""


def sec(name):
    global section
    section = name
    print(f"\n== {name}")


def check(label, cond, detail=""):
    results.append((section, label, bool(cond), detail))
    print(("  PASS  " if cond else "  FAIL  ") + label + ("" if cond else f"   <- {detail}"))


def skip(label, why):
    results.append((section, label, None, why))
    print(f"  SKIP  {label}   ({why})")


# ── dates ───────────────────────────────────────────────────────────────────
today = dt.date.today()
def day(n):  # n days from today, moved forward to a weekday
    d = today + dt.timedelta(days=n)
    while d.weekday() > 4:
        d += dt.timedelta(days=1)
    return d.isoformat()
def saturday(n):
    d = today + dt.timedelta(days=n)
    while d.weekday() != 5:
        d += dt.timedelta(days=1)
    return d.isoformat()
def last_sunday_october(year):
    d = dt.date(year, 10, 31)
    while d.weekday() != 6:
        d -= dt.timedelta(days=1)
    return d
FAR = 40  # far enough ahead that the seeded fake bookings (up to ~3 weeks out) can't clash


def main():
    if not os.environ.get("NO_SEED"):
        print("Resetting the local fake data (seed:v2)…")
        r = subprocess.run(["pnpm", "--filter", "@workspace/scripts", "run", "seed:v2"], cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            sys.exit("The seed failed (is pnpm on your PATH, and is the database local?):\n" + (r.stdout + r.stderr)[-600:])

    ad, a2, an, ca, gu = (login(f"{n}@example.test") for n in ("admin1", "admin2", "ana", "carla", "guest"))
    room = {r["name"]: r["id"] for r in ad.get("/rooms").json}

    # ─────────────────────────────────────────────────────────────────────
    sec("Removed: plans, pricing, quotas, discounts, desk booking, billing and invoices")
    for label, c, m, p in [("desk booking", an, "POST", "/desks"), ("invoices", an, "GET", "/invoices"), ("pricing / plans", an, "GET", "/summary"),
                           ("public leads page", Client(), "POST", "/public/leads"), ("old office info page", an, "GET", "/office")]:
        check(f"no endpoint for {label}", c.call(m, p, {} if m == "POST" else None).status == 404, f"{m} {p}")
    me = an.get("/me").json
    check("a person has no plan or quota fields", not any(k in me for k in ("plan", "deskDaysPerMonth", "priceCents")), str(list(me)))
    users = ad.get("/admin/users").json
    check("user list has no billing fields", not any(k in users[0] for k in ("priceCents", "vatNumber", "plan")), str(list(users[0])))

    sec("Bugs: timezone (a 09:00 booking must show as 09:00, also across the autumn clock change)")
    y = today.year if last_sunday_october(today.year) - dt.timedelta(days=3) > today + dt.timedelta(days=1) else today.year + 1
    sun = last_sunday_october(y)
    fri, mon = (sun - dt.timedelta(days=2)).isoformat(), (sun + dt.timedelta(days=1)).isoformat()
    # 07:30 Braga time: before the seeded bookings, so the slot is free
    r1 = an.post("/bookings", {"roomId": room["Charlie"], "title": "tz before", "date": fri, "start": "07:30", "end": "08:00"})
    r2 = an.post("/bookings", {"roomId": room["Charlie"], "title": "tz after", "date": mon, "start": "07:30", "end": "08:00"})
    mine = {b["title"]: b for b in an.get("/my-bookings").json["upcoming"]}
    check(f"{fri} 07:30 (summer time) is stored as 06:30 UTC", r1.status == 201 and mine["tz before"]["startsAt"] == f"{fri}T06:30:00.000Z", str(mine.get("tz before")))
    check(f"{mon} 07:30 (winter time) is stored as 07:30 UTC", r2.status == 201 and mine["tz after"]["startsAt"] == f"{mon}T07:30:00.000Z", str(mine.get("tz after")))
    dash = open(os.path.join(ROOT, "artifacts/portal/src/pages/Dashboard.tsx")).read()
    check("the admin dashboard subtitle says Office 42 · Braga (the old app said Lisbon)", 'subtitle="Office 42 · Braga"' in dash and "Lisbon" not in dash)

    # ─────────────────────────────────────────────────────────────────────
    sec("Users and login")
    check("one account type, with an admin role", me["role"] == "user" and ad.get("/me").json["role"] == "admin")
    check("several admins, all with the same permissions", all(c.get("/admin/users").status == 200 for c in (ad, a2)) and sum(u["role"] == "admin" for u in users) == 3)
    check("people have name, email, company and (if any) tag", all(k in users[0] for k in ("name", "email", "company", "tag")))
    check("a 'one-off event' user type exists, without a company", any(u["kind"] == "event" and not u["company"] for u in users))
    check("an ordinary user can't open admin pages", all(an.get(p).status == 403 for p in ("/admin/users", "/admin/tags", "/admin/settings", "/admin/metrics")))
    check("not signed in: admin pages are refused", all(Client().get(p).status == 401 for p in ("/admin/users", "/me", "/rooms", "/items")))
    # password option
    nu = ad.post("/admin/users", {"name": "Pat Word", "email": "pat@example.test", "kind": "company"})
    pat = login("pat@example.test")
    check("magic link signs in", pat.get("/me").status == 200)
    check("password: too short is refused", pat.post("/auth/set-password", {"password": "short"}).status == 400)
    check("password: can be set right after signing in with the link", pat.post("/auth/set-password", {"password": "a long local test phrase"}).status == 200)
    pw = Client()
    check("password sign-in works", pw.post("/auth/password", {"email": "pat@example.test", "password": "a long local test phrase"}).status == 200 and pw.get("/me").status == 200)
    w1 = Client().post("/auth/password", {"email": "pat@example.test", "password": "wrong wrong wrong"})
    w2 = Client().post("/auth/password", {"email": "nobody@example.test", "password": "wrong wrong wrong"})
    check("a wrong password and an unknown email look the same", w1.status == w2.status == 401 and w1.json == w2.json)
    for _ in range(5):
        Client().post("/auth/password", {"email": "pat@example.test", "password": "wrong wrong wrong"})
    check("5 wrong tries lock the account for a while", Client().post("/auth/password", {"email": "pat@example.test", "password": "a long local test phrase"}).status == 429)
    check("…but the emailed link still works while locked", login("pat@example.test").get("/me").status == 200)
    # someone who leaves
    pid = nu.json["id"]
    pat2, pw2 = login("pat@example.test"), Client()
    pw2.post("/auth/password", {"email": "pat@example.test", "password": "a long local test phrase"})
    old_link = Client().post("/auth/request", {"email": "pat@example.test", "origin": BASE}).json["devLink"]
    off = ad.post(f"/admin/users/{pid}/deactivate")
    check("deactivate: the person is signed out everywhere at once", off.status == 200 and pat2.get("/me").status == 401 and pw2.get("/me").status == 401)
    again = Client().post("/auth/request", {"email": "pat@example.test", "origin": BASE})
    late = Client(); late.call("GET", old_link[len(API):])
    check("…and can't sign in: no new link, an old link fails, the password fails", again.status == 200 and "devLink" not in (again.json or {}) and late.get("/me").status == 401 and Client().post("/auth/password", {"email": "pat@example.test", "password": "a long local test phrase"}).status == 401)
    check("…shown as deactivated; an admin can't deactivate themselves; a user can't deactivate anyone", next(u for u in ad.get("/admin/users").json if u["id"] == pid)["deactivatedAt"] and ad.post(f"/admin/users/{ad.get('/me').json['id']}/deactivate").status == 400 and an.post(f"/admin/users/{pid}/reactivate").status == 403)
    check("reactivate: they can sign in again", ad.post(f"/admin/users/{pid}/reactivate").status == 200 and login("pat@example.test").get("/me").status == 200)
    page = open(os.path.join(ROOT, "artifacts/portal/src/pages/Login.tsx")).read() + open(os.path.join(ROOT, "artifacts/portal/src/pages/Account.tsx")).read()
    check("login/account forms carry the hints password managers (Bitwarden, browser) look for", all(t in page for t in ('autoComplete="username"', 'autoComplete="current-password"', 'autoComplete="new-password"')))

    sec("Onboarding a new user")
    uid = ad.post("/admin/users", {"name": "Nova Pessoa", "email": "nova@example.test", "kind": "company", "companyId": next(c["id"] for c in ad.get("/admin/companies").json if c["name"] == "Onda")}).json["id"]
    check("1. create the user (name + email) and get an ID", bool(uid))
    tags = {t["number"]: t for t in ad.get("/admin/tags").json["tags"]}
    check("4-digit code: anything else is refused", ad.post(f"/admin/users/{uid}/onboard", {"tagNumber": "T-007", "code": "12a4"}).status == 400)
    ad.put(f"/admin/tags/{tags['T-006']['id']}/code", {"code": "4821"})
    check("a code already used by another tag is rejected", ad.post(f"/admin/users/{uid}/onboard", {"tagNumber": "T-007", "code": "4821"}).status == 409)
    ob = ad.post(f"/admin/users/{uid}/onboard", {"tagNumber": "T-007", "code": "4822"})
    check("2-4. give a tag + choose the code; the change joins the pending batch", ob.status == 201 and any(l["tagNumber"] == "T-007" and l["kind"] == "assign" for l in ad.get("/admin/tags").json["open"]["lines"]))
    mail = (ob.json or {}).get("welcome", {}).get("preview", {})
    body = mail.get("body", "")
    check("5. welcome email: welcome + free seating + MyJABLOTRON links + tag + code + 'may not be active yet'",
          all(s in body for s in ("Welcome", "Seating is free", "myjablotron", "jablonet.net", "T-007", "4822", "may not be active yet")), body[:80])
    check("welcome email still has [gaps] to fill in (coffee, equipment, videos)", "[add" in body)
    ed = ad.put("/admin/welcome-email", {"subject": "Hi {{name}}", "body": "Tag {{tag}} / code {{code}} / {{link}}"})
    again = ad.post(f"/admin/users/{uid}/invite", {"origin": BASE}).json
    check("admins can edit the welcome email copy", ed.status == 200 and again["preview"]["subject"] == "Hi Nova Pessoa" and "T-007" in again["preview"]["body"])
    link = again["devLink"]
    r1 = Client().call("GET", link[len(API):]); r2 = Client().call("GET", link[len(API):])
    check("invite link opens the account page once, then no longer works", r1.status == 302 and "welcome=1" in r1.headers.get("Location", "") and "expired" in r2.headers.get("Location", ""))
    check("the email text says it is NOT sent yet (no email service connected)", again["sent"] is False)

    # ─────────────────────────────────────────────────────────────────────
    sec("Home: messages")
    m = an.post("/messages", {"body": "Spare charger on my desk"})
    cur = {x["body"]: x for x in an.get("/messages").json["current"]}["Spare charger on my desk"]
    days = (dt.datetime.fromisoformat(cur["expiresAt"].replace("Z", "+00:00")) - dt.datetime.now(dt.timezone.utc)).total_seconds() / 86400
    check("anyone can post; the default duration is one week", m.status == 201 and 6.9 < days < 7.1, f"{days:.2f} days")
    check("the duration is adjustable", an.post("/messages", {"body": "short one", "days": 1}).status == 201 and an.post("/messages", {"body": "x", "days": 0}).status == 400)
    check("the author can edit (text and duration)", an.patch(f"/messages/{m.json['id']}", {"body": "Spare charger (taken)", "days": 3}).status == 200)
    check("others can't edit it", ca.patch(f"/messages/{m.json['id']}", {"body": "hijack"}).status == 403)
    check("only admins pin", ca.patch(f"/messages/{m.json['id']}", {"pinned": True}).status == 403 and ad.patch(f"/messages/{m.json['id']}", {"pinned": True}).status == 200)
    check("past messages can be viewed", len(an.get("/messages").json["past"]) >= 1)
    check("admins can delete any message; others can't", ca.delete(f"/messages/{m.json['id']}").status == 404 and ad.delete(f"/messages/{m.json['id']}").status == 200)
    check("the old separate community board and announcements are gone", an.get("/posts").status == 404 and an.get("/announcements").status == 404)

    sec("Home: issues and requests")
    pub = an.post("/items", {"kind": "issue", "visibility": "public", "title": "Door sticks", "body": "front door"})
    prv = an.post("/items", {"kind": "request", "visibility": "private", "title": "Ergonomic chair"})
    check("one form: title, text, type (issue/request), visibility (public/private)", pub.status == 201 and prv.status == 201 and an.post("/items", {"kind": "supply", "visibility": "public", "title": "x"}).status == 400)
    seen = {i["title"] for i in ca.get("/items").json}
    check("public items are visible to everyone, private ones only to the author and admins", "Door sticks" in seen and "Ergonomic chair" not in seen and "Ergonomic chair" in {i["title"] for i in ad.get("/items").json})
    check("people can follow open public items (not someone else's private ones)", ca.post(f"/items/{pub.json['id']}/follow").status == 200 and ca.post(f"/items/{prv.json['id']}/follow").status == 404)
    ad.patch(f"/admin/items/{pub.json['id']}", {"claim": True, "statusNote": "Called the landlord"})
    it = {i["title"]: i for i in ca.get("/items").json}["Door sticks"]
    check("everyone sees who is handling it and the status note", it["status"] == "claimed" and it["claimedByName"] == "Admin One" and it["statusNote"] == "Called the landlord" and it["following"])

    # ─────────────────────────────────────────────────────────────────────
    sec("Rooms")
    rooms = ad.get("/rooms").json
    check("three rooms: Alfa (4), Bravo (4, unconfirmed in the spec), Charlie (6)", {r["name"]: r["seats"] for r in rooms} == {"Alfa": 4, "Bravo": 4, "Charlie": 6})
    png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108020000009077" "53de0000000c4944415408d763f8cfc000000301010018dd8db00000000049454e44ae426082")
    up = ad.call("PUT", f"/admin/rooms/{room['Alfa']}/photo", raw=multipart({}, "file", "a.png", png, "image/png"))
    check("admins set room names and photos; everyone sees both", ad.patch(f"/admin/rooms/{room['Bravo']}", {"name": "Bravo", "seats": 4}).status == 200 and up.status == 200 and ca.get(f"/rooms/{room['Alfa']}/photo").status == 200)
    check("a user can't change rooms; a fake image is refused", an.patch(f"/admin/rooms/{room['Bravo']}", {"name": "x", "seats": 1}).status == 403 and ad.call("PUT", f"/admin/rooms/{room['Alfa']}/photo", raw=multipart({}, "file", "a.png", b"not an image", "image/png")).status == 400)
    gp = ad.call("POST", "/admin/guide-photos", raw=multipart({}, "file", "g.png", png, "image/png"))
    gurl = (gp.json or {}).get("url", "")
    check("admins upload photos for the guides; everyone signed in sees them, nobody else", gp.status == 201 and gurl.startswith("/api/portal/guide-photos/") and an.get(gurl[len("/api/portal"):]).status == 200 and Client().get(gurl[len("/api/portal"):]).status == 401)
    check("…a user can't upload guide photos, and a fake image is refused", an.call("POST", "/admin/guide-photos", raw=multipart({}, "file", "g.png", png, "image/png")).status == 403 and ad.call("POST", "/admin/guide-photos", raw=multipart({}, "file", "g.png", b"nope", "image/png")).status == 400)
    d1 = day(FAR)
    b1 = an.post("/bookings", {"roomId": room["Alfa"], "title": "Interview", "bookedFor": "Dr. Silva (candidate)", "date": d1, "start": "10:00", "end": "11:00"})
    ours = {b["title"]: b for b in an.get("/my-bookings").json["upcoming"]}["Interview"]
    check("bookings are in the booker's own name; anyone can book for someone else with a note", b1.status == 201 and ours["bookedFor"] == "Dr. Silva (candidate)" and ours["owner"] == "Ana Costa")
    check("there are no booking rules: late night / weekend is fine (24/7)", an.post("/bookings", {"roomId": room["Alfa"], "title": "Night sprint", "date": saturday(FAR), "start": "22:00", "end": "24:00"}).status == 201)
    check("an overlapping booking is refused", ca.post("/bookings", {"roomId": room["Alfa"], "title": "Clash", "date": d1, "start": "10:30", "end": "11:30"}).status == 409)
    rng = f"from={d1}T00:00:00Z&to={d1}T23:59:59Z"
    anon = [b for b in ca.get(f"/bookings?{rng}").json if b["id"] == b1.json["id"]][0]
    check("others only see that the slot is reserved; admins see the details", "title" not in anon and ad.get(f"/bookings?{rng}").json[0].get("title") == "Interview")
    check("users create, edit and cancel their own bookings", an.put(f"/bookings/{b1.json['id']}", {"roomId": room["Alfa"], "title": "Interview (long)", "date": d1, "start": "10:00", "end": "12:00"}).status == 200)
    check("others can't edit or cancel them", ca.put(f"/bookings/{b1.json['id']}", {"roomId": room["Alfa"], "title": "mine", "date": d1, "start": "10:00", "end": "12:00"}).status == 403 and ca.delete(f"/bookings/{b1.json['id']}").status == 404)
    check("admins can edit any booking", ad.put(f"/bookings/{b1.json['id']}", {"roomId": room["Alfa"], "title": "Interview (moved)", "date": d1, "start": "14:00", "end": "15:00"}).status == 200)
    blk = ad.post("/admin/blocks", {"kind": "cleaning", "roomId": "all", "title": "Morning cleaning", "date": day(FAR + 1), "start": "06:00", "end": "07:00"})
    check("cleaning/maintenance slots are shown on the calendar", blk.status == 201 and any(b["kind"] == "cleaning" for b in ca.get(f"/blocks?from={day(FAR+1)}T00:00:00Z&to={day(FAR+1)}T23:59:59Z").json))
    check("…and rooms can't be booked over them", an.post("/bookings", {"roomId": room["Bravo"], "title": "Early", "date": day(FAR + 1), "start": "06:30", "end": "07:30"}).status == 409)
    check("admins can cancel any booking", ad.delete(f"/bookings/{b1.json['id']}").status == 200)
    check("users can't create blocks", an.post("/admin/blocks", {"kind": "cleaning", "date": day(FAR), "start": "06:00", "end": "07:00"}).status == 403)

    sec("Personal area")
    area = an.get("/area").json
    check("WiFi: everyone sees the guest network, the internal one is hidden from other domains", [w["label"] for w in area["wifi"]] == ["Guest WiFi"])
    if os.environ.get("CHECK_DATABASE_URL"):
        psql = lambda sql: subprocess.run(["psql", os.environ["CHECK_DATABASE_URL"], "-qc", sql], capture_output=True)
        psql("update portal_clients set email='ana@subvisual.co' where email='ana@example.test'")
        sees = [w["label"] for w in an.get("/area").json["wifi"]]
        psql("update portal_clients set email='ana@example.test' where email='ana@subvisual.co'")
        check("WiFi: @subvisual.co accounts also see the internal network", sees == ["Guest WiFi", "Internal WiFi"], str(sees))
    else:
        skip("WiFi: @subvisual.co accounts also see the internal network", "set CHECK_DATABASE_URL (the fake users use example.test)")
    check("guides: how to open the door, use the app, sign up", {g["id"] for g in area["guides"]} >= {"door", "app", "signup"})
    mt = ca.get("/my-tag").json
    check("tag number and code are NOT in the normal page data (hidden behind a toggle)", "number" not in json.dumps(mt) and "code" not in json.dumps(mt).replace("hasCode", ""))
    ad.put(f"/admin/tags/{tags['T-004']['id']}/code", {"code": "1357"})
    rv = ca.get("/my-tag/code").json
    check("…the number and code are sent only when asked, and only for your own tag", rv["number"] == "T-004" and rv["code"] == "1357" and an.get("/my-tag/code").json["number"] == "T-003")
    nv = login("nova@example.test")
    check("a pending tag request is shown until the supplier confirms it", nv.get("/my-tag").json["pending"]["kind"] == "assign")
    if os.environ.get("CHECK_DATABASE_URL"):
        psql = lambda sql: subprocess.run(["psql", os.environ["CHECK_DATABASE_URL"], "-qc", sql], capture_output=True)
        psql(f"update portal_tags set code_enc=null, code_fp=null where id='{tags['T-004']['id']}'")
        check("a tag with no code: the holder can record their own 4-digit code once", ca.post("/my-tag/code", {"code": "12"}).status == 400 and ca.post("/my-tag/code", {"code": "2468"}).status == 201 and ca.get("/my-tag/code").json["code"] == "2468")
        check("…and cannot change it afterwards (an admin can)", ca.post("/my-tag/code", {"code": "9999"}).status == 409)
        ad.put(f"/admin/tags/{tags['T-004']['id']}/code", {"code": "1357"})
    else:
        skip("a tag with no code: the holder can record their own code once", "set CHECK_DATABASE_URL to run this one")
    check("requests from here: a new tag, a lost tag, a new code (they reach the admins)", all(ca.post("/me/request", {"kind": k}).status == 201 for k in ("new", "lost", "code")) and ca.post("/me/request", {"kind": "lost"}).status == 409)

    # ─────────────────────────────────────────────────────────────────────
    sec("Tags and the supplier (Ricardo) flow")
    T = lambda: {t["number"]: t for t in ad.get("/admin/tags").json["tags"]}
    guest = next(u["id"] for u in ad.get("/admin/users").json if u["email"] == "guest@example.test")
    a3 = next(u["id"] for u in ad.get("/admin/users").json if u["email"] == "admin3@example.test")
    ch = lambda n, body: ad.post(f"/admin/tags/{T()[n]['id']}/changes", body)
    check("statuses: active, spare, lost, blocked (+ pending shown while a change is waiting)", {"active", "spare", "lost", "blocked", "pending"} <= {t["status"] for t in T().values()})
    r = [ch("T-006", {"kind": "assign", "userId": guest}), ch("T-003", {"kind": "reassign", "userId": a3}), ch("T-004", {"kind": "rename", "name": "Carla Dias-Moreira"}), ch("T-005", {"kind": "lost"}), ch("T-002", {"kind": "return"})]
    check("new user / spare assigned / reassigned / renamed / lost / returned all create a change", all(x.status == 201 for x in r), str([x.status for x in r]))
    check("one tag can't have two changes waiting", ch("T-003", {"kind": "rename", "name": "x"}).status == 409)
    open_b = ad.get("/admin/tags").json["open"]
    check("changes are collected in ONE open batch until an admin sends it", len([l for l in open_b["lines"] if l["status"] == "pending"]) >= 6)
    check("until the supplier does it, the tag shows 'pending' with the OLD name", T()["T-003"]["status"] == "pending" and T()["T-003"]["holderName"] == "Ana Costa")
    sent = ad.post("/admin/tag-batches/send", {"origin": BASE})
    token = sent.json["link"].split("/access/")[1]
    check("sending gives a link plus a copy-paste message", sent.status == 201 and sent.json["message"] == f"Ricardo, here's a new request: {sent.json['link']}")
    check("the sent batch is closed; the next change starts a new batch", ad.get("/admin/tags").json["open"] is None)
    pub_c = Client()
    page = pub_c.get(f"/access/{token}")
    lines = page.json["lines"]
    check("Ricardo's page needs no account and shows one line per tag (tag, current name, new name)", page.status == 200 and {"tagNumber", "fromName", "toName", "kind"} <= set(lines[0]))
    check("…without door codes, emails or notes", not any(k in json.dumps(lines) for k in ("code", "email", "note")))
    check("…and with privacy headers (no cache, no indexing, no referrer)", page.headers.get("Cache-Control") == "no-store" and "noindex" in page.headers.get("X-Robots-Tag", "") and page.headers.get("Referrer-Policy") == "no-referrer")
    one = next(l for l in lines if l["tagNumber"] == "T-006")
    check("Done on one line updates the tag record", pub_c.post(f"/access/{token}/lines/{one['id']}/done").status == 200 and T()["T-006"]["holderName"] == "Event Guest" and T()["T-006"]["status"] == "active")
    check("Done is logged, and all admins are notified", any(i["tagNumber"] == "T-006" for i in a2.get("/admin/tag-notifications").json["items"]) and a2.get("/admin/tag-notifications").json["unread"] >= 1)
    check("each admin has their own 'seen' marker", a2.post("/admin/tag-notifications/seen").status == 200 and a2.get("/admin/tag-notifications").json["unread"] == 0 and ad.get("/admin/tag-notifications").json["unread"] >= 1)
    allr = pub_c.post(f"/access/{token}/done-all").json
    check("'Mark all done' applies the rest", allr["done"] == 6 and allr["outdated"] == 0, str(allr))
    t = T()
    check("reassigned / renamed / lost (→ no owner) / returned (→ spare) end up right", t["T-003"]["holderName"] == "Admin Three" and t["T-004"]["holderName"] == "Carla Dias-Moreira" and t["T-005"]["status"] == "lost" and t["T-002"]["status"] == "spare")
    log = ad.get("/admin/tag-log?limit=100").json
    check("every change is in the log (who, what, when)", {"change_added", "batch_sent", "line_done"} <= {e["event"] for e in log} and all(e["actor"] for e in log))
    ch("T-001", {"kind": "rename", "name": "Admin One (new)"}); s2 = ad.post("/admin/tag-batches/send", {"origin": BASE}); tk2 = s2.json["link"].split("/access/")[1]
    if os.environ.get("CHECK_DATABASE_URL"):
        subprocess.run(["psql", os.environ["CHECK_DATABASE_URL"], "-qc", "update portal_tags set status='lost', client_id=null where number='T-001'"], capture_output=True)
        res = Client().post(f"/access/{tk2}/done-all").json
        check("a line whose tag changed in the meantime is NOT applied (marked out of date)", res["outdated"] == 1 and res["done"] == 0, str(res))
    else:
        skip("a line whose tag changed in the meantime is NOT applied (marked out of date)", "set CHECK_DATABASE_URL to run this one")
    check("leaving the office: admin marks a tag lost (and can change its code right away)", ad.put(f"/admin/tags/{T()['T-005']['id']}/code", {"code": "9999"}).status == 200)
    check("admins can change a code themselves; a code already used is refused", ad.put(f"/admin/tags/{T()['T-005']['id']}/code", {"code": "1357"}).status == 409)
    bid = ad.get("/admin/tags").json["sent"][0]["id"]
    new_link = ad.post(f"/admin/tag-batches/{bid}/regenerate-link", {"origin": BASE}).json["link"].split("/access/")[1]
    check("a new link replaces the old one", Client().get(f"/access/{tk2}").status == 404 and Client().get(f"/access/{new_link}").status == 200)
    check("a revoked link stops working", ad.post(f"/admin/tag-batches/{bid}/revoke-link").status == 200 and Client().get(f"/access/{new_link}").status == 404)
    check("a made-up link gets the same answer as an expired one", Client().get("/access/" + "A" * 43).json == Client().get(f"/access/{new_link}").json)
    done_line = next(l for b in ad.get("/admin/tags").json["sent"] for l in b["lines"] if l["tagNumber"] == "T-006" and l["status"] == "done")
    check("an admin can undo a mistaken Done while the tag is unchanged", ad.post(f"/admin/changes/{done_line['id']}/reopen").status == 200 and T()["T-006"]["baseStatus"] == "spare" and T()["T-006"]["pending"] is not None)  # back to how it was, waiting again
    check("blocking a tag is direct (no supplier needed)", ad.patch(f"/admin/tags/{T()['T-003']['id']}", {"status": "blocked"}).status == 200 and T()["T-003"]["status"] == "blocked")

    # ─────────────────────────────────────────────────────────────────────
    sec("Admin")
    cnt = ad.get("/inbox/count").json
    check("dashboard inbox: unclaimed items, pending batch and supplier updates are counted", {"pending", "items", "openTagLines", "supplierUpdates"} <= set(cnt))
    it_id = {i["title"]: i["id"] for i in ad.get("/items").json}["Ergonomic chair"]
    moves = [ad.patch(f"/admin/items/{it_id}", b).status for b in ({"claim": True}, {"status": "done"}, {"status": "open", "claim": False})]
    check("issues board: open → claimed → done (and back), with a status note", moves == [200, 200, 200] and ad.patch(f"/admin/items/{it_id}", {"statusNote": "not called yet"}).status == 200)
    check("claiming is admin-only, and there are no notifications to the author", an.patch(f"/admin/items/{it_id}", {"claim": True}).status == 403)
    sp = ad.post("/admin/suppliers", {"name": "Green Garden", "what": "Plants", "contactName": "Sofia", "phone": "+351 000 000 009"})
    check("suppliers: name, contacts and what each does (add, edit, delete)", sp.status == 201 and ad.patch(f"/admin/suppliers/{sp.json['id']}", {"notes": "Tuesdays"}).json["contactName"] == "Sofia")
    check("…and one can be attached to an issue", ad.patch(f"/admin/items/{it_id}", {"supplierId": sp.json["id"]}).status == 200 and ad.delete(f"/admin/suppliers/{sp.json['id']}").status == 200)
    y1 = (today - dt.timedelta(days=300)).isoformat(); y2 = (today - dt.timedelta(days=400)).isoformat()
    h = ad.get(f"/admin/bookings?from={y1}&to={today.isoformat()}").json
    check("past bookings go back one year (and no further)", len(h["rows"]) > 0 and ad.get(f"/admin/bookings?from={y2}&to={today.isoformat()}").status == 400)
    mt = ad.get("/admin/metrics?granularity=week&periods=6").json
    p0 = mt["overall"][0]
    check("metrics: occupancy % by week and by month, overall and per room", len(mt["overall"]) == 6 and set(mt["byRoom"]) == set(room.values()) and len(ad.get("/admin/metrics?granularity=month&periods=12").json["overall"]) == 12)
    check("…the percentage is booked hours / available hours", abs(p0["pct"] - round(p0["booked"] / p0["available"] * 100, 1)) < 0.11, str(p0))
    check("…plus peak hours (all 24 hours)", len(mt["peak"]["overall"]) == 24 and len(mt["peak"]["top"]) >= 1)
    ad.put("/admin/settings/booking-note", {"text": "Book what you need. Cancel if plans change."})
    ad.put("/admin/settings/guides", {"guides": [{"id": "door", "title": "Door", "body": "Tap and push."}]})
    ad.put("/admin/settings/wifi", {"networks": [{"label": "Guest", "visibility": "everyone", "ssid": "Office-Guest", "password": "fake-pass", "note": ""}]})
    ar = an.get("/area").json
    check("settings: admins edit the booking note, guides and WiFi, and people see the change", ar["bookingNote"].startswith("Book what you need") and [g["title"] for g in ar["guides"]] == ["Door"] and ar["wifi"][0]["password"] == "fake-pass")
    check("settings: the metrics working window is editable (and refused when it makes no sense)", ad.put("/admin/settings/occupancy-window", {"startHour": 9, "endHour": 18, "weekdays": [1, 2, 3, 4, 5]}).status == 200 and ad.put("/admin/settings/occupancy-window", {"startHour": 18, "endHour": 9, "weekdays": [1]}).status == 400)
    ad.put("/admin/settings/occupancy-window", {"startHour": 8, "endHour": 20, "weekdays": [1, 2, 3, 4, 5]})
    check("users: list, invites, companies", ad.get("/admin/users").status == 200 and ad.post("/admin/companies", {"name": "Brand New Co"}).status == 201 and ad.post("/admin/companies", {"name": "brand new co"}).status == 409)

    # ─────────────────────────────────────────────────────────────────────
    sec("Security basics")
    admin_paths = ["GET /admin/users", "GET /admin/tags", "GET /admin/settings", "GET /admin/suppliers", "GET /admin/bookings", "GET /admin/metrics", "GET /admin/tag-log", "GET /inbox/count", "POST /admin/tag-batches/send", "POST /admin/blocks"]
    check("every admin endpoint refuses people who aren't signed in (401) or aren't admins (403)",
          all(Client().call(p.split()[0], p.split()[1], {} if p.startswith("POST") else None).status == 401 and an.call(p.split()[0], p.split()[1], {} if p.startswith("POST") else None).status == 403 for p in admin_paths))
    lnk = Client().post("/auth/request", {"email": "admin1@example.test", "origin": BASE}).json["devLink"]
    cookie = Client().call("GET", lnk[len(API):]).headers.get("Set-Cookie", "")
    check("the session cookie is HttpOnly and SameSite=Lax (and Secure when NODE_ENV=production)", "HttpOnly" in cookie and "SameSite=Lax" in cookie, cookie)
    if os.environ.get("CHECK_RATE_LIMIT"):
        last = [Client().get("/access/" + os.urandom(32).hex()[:43]).status for _ in range(24)][-1]
        check("the supplier's page is rate-limited against guessing", last == 429, f"last status {last}")
        print("  (this blocked your IP on the supplier page for an hour: restart the API before running again)")
    else:
        skip("the supplier's page is rate-limited against guessing", "set CHECK_RATE_LIMIT=1; it locks that page for an hour until the API restarts")
    if os.environ.get("CHECK_DATABASE_URL"):
        q = lambda sql: subprocess.run(["psql", os.environ["CHECK_DATABASE_URL"], "-tAc", sql], capture_output=True, text=True).stdout.strip()
        check("sessions, sign-in links and the supplier link are stored hashed, not readable", all(len(x) == 64 for x in (q("select id from portal_sessions limit 1"), q("select token from portal_login_tokens limit 1"), q("select link_hash from portal_tag_batches where link_hash is not null limit 1"))))
        check("door codes are stored encrypted (no 4-digit code in the tags table)", q("select count(*) from portal_tags where code_enc ~ '^[0-9]{4}$'") == "0")
        check("no door code or link appears in the tag log", q("select count(*) from portal_tag_log where detail ~ '(4821|4822|1357|9999)' or detail like '%/access/%'") == "0")
    else:
        skip("tokens stored hashed / codes stored encrypted / nothing sensitive in the log", "set CHECK_DATABASE_URL to run these")

    # ── summary ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    names = list(dict.fromkeys(s for s, *_ in results))
    for n in names:
        rs = [r for r in results if r[0] == n]
        print(f"{sum(1 for r in rs if r[2])}/{sum(1 for r in rs if r[2] is not None)} {'OK ' if all(r[2] in (True, None) for r in rs) else 'FAIL'}  {n}")
    failed = [r for r in results if r[2] is False]
    skipped = [r for r in results if r[2] is None]
    print(f"\n{sum(1 for r in results if r[2])} passed, {len(failed)} failed, {len(skipped)} skipped")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
