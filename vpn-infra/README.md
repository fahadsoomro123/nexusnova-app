# Nova VPN production VPS system

This directory is the server-side counterpart of the Android Nova VPN client.

## Production target

- WireGuard kernel tunnel on every VPS.
- At least 1 Gbps advertised network capacity per production node.
- Public IPv4 and IPv6.
- Minimum 2 vCPU / 2 GB RAM per node.
- UDP 51820 open for WireGuard; HTTPS 443 open for health/provision/revoke API.
- Local Unbound DNS inside the tunnel so client DNS follows the VPN route.
- Per-user short-lived WireGuard peer leases authenticated with the existing NexusNova Firebase ID token.
- No shared client private keys. Android generates a fresh private key locally for each connection.
- Multiple geographic nodes. The Android client measures real latency and selects the lowest measured healthy node with Smart Pick.

## Node bootstrap

Copy `vpn-infra/node/` to a fresh Ubuntu 24.04 LTS VPS. Point a `nexusnovatools.com` subdomain at the VPS first, then run as root:

```bash
export NOVA_VPN_NODE_ID='node-1'
export NOVA_VPN_PUBLIC_HOST='node-1.vpn.nexusnovatools.com'
export NOVA_VPN_CITY='SET_CITY'
export NOVA_VPN_COUNTRY='SET_COUNTRY'
export NOVA_VPN_CAPACITY_MBPS='1000'
export NOVA_FIREBASE_WEB_API_KEY='SET_EXISTING_NEXUSNOVA_FIREBASE_WEB_API_KEY'
export NOVA_VPN_TLS_EMAIL='SET_TLS_EMAIL'
bash bootstrap.sh
```

The bootstrap installs WireGuard, nftables forwarding/NAT, Unbound DNS, HTTPS, the Nova VPN lease service, and the systemd units. It also sets larger kernel network buffers and an `fq` egress queue.

## Multi-node activation

Repeat the bootstrap on independent VPS nodes. Use a unique host name and `NOVA_VPN_NODE_ID` for each. After the health URL for a node returns HTTP 200, add that node to `https://nexusnovatools.com/vpn/servers.json` and set `enabled: true`.

The live Android client currently accepts up to 24 servers and measures them in parallel before Smart Pick chooses the lowest-latency healthy server.

## Important operational rule

Do not put placeholder, public/free VPN, or unowned WireGuard endpoints into the production catalog. A server becomes visible to users only after the VPS exists, TLS is valid, `/health` works, and `/v1/lease` successfully provisions an authenticated WireGuard peer.
