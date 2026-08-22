#!/usr/bin/env python3
import hashlib
import ipaddress
import json
import os
import re
import secrets
import sqlite3
import subprocess
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

NODE_ID = os.environ.get("NOVA_VPN_NODE_ID", "").strip()
PUBLIC_HOST = os.environ.get("NOVA_VPN_PUBLIC_HOST", "").strip().lower()
CITY = os.environ.get("NOVA_VPN_CITY", "").strip()
COUNTRY = os.environ.get("NOVA_VPN_COUNTRY", "").strip()
CAPACITY_MBPS = int(os.environ.get("NOVA_VPN_CAPACITY_MBPS", "0"))
FIREBASE_API_KEY = os.environ.get("NOVA_FIREBASE_WEB_API_KEY", "").strip()
WG_INTERFACE = os.environ.get("NOVA_VPN_WG_INTERFACE", "wg0").strip()
WG_PORT = int(os.environ.get("NOVA_VPN_WG_PORT", "51820"))
LEASE_SECONDS = min(86400, max(900, int(os.environ.get("NOVA_VPN_LEASE_SECONDS", "21600"))))
DB_PATH = Path(os.environ.get("NOVA_VPN_DB", "/var/lib/nova-vpn/leases.sqlite3"))
SERVER_PUBLIC_KEY_PATH = Path(os.environ.get("NOVA_VPN_SERVER_PUBLIC_KEY", "/etc/wireguard/server_public.key"))
IPV4_NET = ipaddress.ip_network(os.environ.get("NOVA_VPN_IPV4_NET", "10.77.0.0/24"), strict=True)
IPV6_NET = ipaddress.ip_network(os.environ.get("NOVA_VPN_IPV6_NET", "fd42:77::/64"), strict=True)
DNS_V4 = str(next(IPV4_NET.hosts()))
DNS_V6 = str(next(IPV6_NET.hosts()))
BIND_HOST = "127.0.0.1"
BIND_PORT = int(os.environ.get("NOVA_VPN_API_PORT", "8787"))
PUBLIC_KEY_RE = re.compile(r"^[A-Za-z0-9+/]{43}=$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")
LOCK = threading.RLock()


def fail(message: str) -> None:
    raise RuntimeError(message)


def require_config() -> None:
    if not ID_RE.fullmatch(NODE_ID):
        fail("NOVA_VPN_NODE_ID is missing or invalid")
    if not PUBLIC_HOST or "." not in PUBLIC_HOST or "/" in PUBLIC_HOST:
        fail("NOVA_VPN_PUBLIC_HOST is missing or invalid")
    if not CITY or not COUNTRY:
        fail("NOVA_VPN_CITY and NOVA_VPN_COUNTRY are required")
    if CAPACITY_MBPS != 0 and not 100 <= CAPACITY_MBPS <= 100000:
        fail("NOVA_VPN_CAPACITY_MBPS must be 0 (unverified) or a verified value from 100 to 100000")
    if not FIREBASE_API_KEY:
        fail("NOVA_FIREBASE_WEB_API_KEY is required")
    if not SERVER_PUBLIC_KEY_PATH.is_file():
        fail("WireGuard server public key is missing")


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS leases (
            lease_id TEXT PRIMARY KEY,
            firebase_uid TEXT NOT NULL,
            peer_key TEXT NOT NULL UNIQUE,
            ipv4 TEXT NOT NULL UNIQUE,
            ipv6 TEXT NOT NULL UNIQUE,
            revoke_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )"""
    )
    conn.commit()
    return conn


def run_wg(*args: str) -> None:
    subprocess.run(["wg", *args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)


def remove_peer(peer_key: str) -> None:
    try:
        run_wg("set", WG_INTERFACE, "peer", peer_key, "remove")
    except subprocess.CalledProcessError:
        pass


def cleanup_expired(conn: sqlite3.Connection) -> None:
    now = int(time.time())
    rows = conn.execute("SELECT lease_id, peer_key FROM leases WHERE expires_at <= ?", (now,)).fetchall()
    for row in rows:
        remove_peer(row["peer_key"])
        conn.execute("DELETE FROM leases WHERE lease_id = ?", (row["lease_id"],))
    if rows:
        conn.commit()


def verify_firebase_token(token: str) -> str:
    if len(token) < 100 or len(token) > 7000:
        fail("invalid auth token")
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}"
    body = json.dumps({"idToken": token}).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=6) as response:
            payload = json.loads(response.read(65536).decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as exc:
        fail(f"firebase verification failed: {exc}")
    users = payload.get("users") or []
    if not users:
        fail("firebase user not found")
    uid = str(users[0].get("localId") or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9:_-]{3,128}", uid):
        fail("firebase uid is invalid")
    return uid


def address_for(slot: int) -> tuple[str, str]:
    if slot < 2 or slot > 254:
        fail("VPN node is at peer capacity")
    v4 = str(IPV4_NET.network_address + slot)
    v6 = str(IPV6_NET.network_address + slot)
    return v4, v6


def allocate_slot(conn: sqlite3.Connection) -> tuple[str, str]:
    used = {row[0] for row in conn.execute("SELECT ipv4 FROM leases")}
    for slot in range(2, 255):
        v4, v6 = address_for(slot)
        if v4 not in used:
            return v4, v6
    fail("VPN node is full")


def create_lease(uid: str, peer_key: str) -> dict:
    now = int(time.time())
    expires = now + LEASE_SECONDS
    with LOCK:
        conn = db()
        try:
            cleanup_expired(conn)
            old_rows = conn.execute("SELECT lease_id, peer_key FROM leases WHERE firebase_uid = ?", (uid,)).fetchall()
            for row in old_rows:
                remove_peer(row["peer_key"])
                conn.execute("DELETE FROM leases WHERE lease_id = ?", (row["lease_id"],))
            v4, v6 = allocate_slot(conn)
            lease_id = secrets.token_urlsafe(24)
            revoke_token = secrets.token_urlsafe(32)
            revoke_hash = hashlib.sha256(revoke_token.encode("utf-8")).hexdigest()
            run_wg("set", WG_INTERFACE, "peer", peer_key, "allowed-ips", f"{v4}/32,{v6}/128")
            conn.execute(
                "INSERT INTO leases (lease_id,firebase_uid,peer_key,ipv4,ipv6,revoke_hash,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)",
                (lease_id, uid, peer_key, v4, v6, revoke_hash, now, expires),
            )
            conn.commit()
        finally:
            conn.close()
    server_key = SERVER_PUBLIC_KEY_PATH.read_text(encoding="utf-8").strip()
    return {
        "serverId": NODE_ID,
        "leaseId": lease_id,
        "endpoint": f"{PUBLIC_HOST}:{WG_PORT}",
        "serverPublicKey": server_key,
        "clientAddresses": [f"{v4}/32", f"{v6}/128"],
        "dns": [DNS_V4, DNS_V6],
        "mtu": 1420,
        "persistentKeepalive": 25,
        "expiresAt": expires,
        "revokeUrl": f"https://{PUBLIC_HOST}/v1/revoke",
        "revokeToken": revoke_token,
    }


def revoke(lease_id: str, token: str) -> bool:
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with LOCK:
        conn = db()
        try:
            cleanup_expired(conn)
            row = conn.execute("SELECT peer_key,revoke_hash FROM leases WHERE lease_id = ?", (lease_id,)).fetchone()
            if row is None or not secrets.compare_digest(row["revoke_hash"], digest):
                return False
            remove_peer(row["peer_key"])
            conn.execute("DELETE FROM leases WHERE lease_id = ?", (lease_id,))
            conn.commit()
            return True
        finally:
            conn.close()


def health_payload() -> dict:
    with LOCK:
        conn = db()
        try:
            cleanup_expired(conn)
            active = int(conn.execute("SELECT COUNT(*) FROM leases").fetchone()[0])
        finally:
            conn.close()
    cpu_count = max(1, os.cpu_count() or 1)
    load_pct = min(100, max(0, round((os.getloadavg()[0] / cpu_count) * 100)))
    peer_capacity = 253
    peer_pct = round((active / peer_capacity) * 100)
    effective_load = min(100, max(load_pct, peer_pct))
    return {
        "ok": True,
        "nodeId": NODE_ID,
        "city": CITY,
        "country": COUNTRY,
        "protocol": "wireguard",
        "capacityVerified": CAPACITY_MBPS > 0,
        "capacityMbps": CAPACITY_MBPS if CAPACITY_MBPS > 0 else None,
        "activePeers": active,
        "peerCapacity": peer_capacity,
        "loadPercent": effective_load,
        "timestamp": int(time.time()),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "NovaVPNNode/1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def send_json(self, code: int, payload: dict, head_only: bool = False) -> None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if not head_only:
            self.wfile.write(data)

    def read_json(self, limit: int = 16384) -> dict:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > limit:
            fail("invalid request size")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def bearer(self) -> str:
        value = self.headers.get("Authorization") or ""
        return value[7:].strip() if value.startswith("Bearer ") else ""

    def do_HEAD(self):
        if self.path == "/health":
            self.send_json(200, health_payload(), head_only=True)
        else:
            self.send_json(404, {"error": "not found"}, head_only=True)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, health_payload())
        else:
            self.send_json(404, {"error": "not found"})

    def do_POST(self):
        try:
            if self.path == "/v1/lease":
                token = self.bearer()
                uid = verify_firebase_token(token)
                payload = self.read_json()
                if str(payload.get("serverId") or "").strip() != NODE_ID:
                    fail("server mismatch")
                peer_key = str(payload.get("clientPublicKey") or "").strip()
                if not PUBLIC_KEY_RE.fullmatch(peer_key):
                    fail("invalid WireGuard client public key")
                self.send_json(200, create_lease(uid, peer_key))
                return
            if self.path == "/v1/revoke":
                payload = self.read_json(8192)
                lease_id = str(payload.get("leaseId") or "").strip()
                server_id = str(payload.get("serverId") or "").strip()
                if server_id != NODE_ID or len(lease_id) < 8:
                    fail("invalid revoke request")
                if not revoke(lease_id, self.bearer()):
                    self.send_json(403, {"error": "revoke denied"})
                else:
                    self.send_json(200, {"ok": True})
                return
            self.send_json(404, {"error": "not found"})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)[:180]})


def main() -> None:
    require_config()
    with db() as conn:
        cleanup_expired(conn)
    server = ThreadingHTTPServer((BIND_HOST, BIND_PORT), Handler)
    print(f"Nova VPN node {NODE_ID} listening on {BIND_HOST}:{BIND_PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
