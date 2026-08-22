#!/usr/bin/env bash
set -euo pipefail

: "${NOVA_VPN_NODE_ID:?set NOVA_VPN_NODE_ID}"
: "${NOVA_VPN_PUBLIC_HOST:?set NOVA_VPN_PUBLIC_HOST}"
: "${NOVA_VPN_CITY:?set NOVA_VPN_CITY}"
: "${NOVA_VPN_COUNTRY:?set NOVA_VPN_COUNTRY}"
: "${NOVA_FIREBASE_WEB_API_KEY:?set NOVA_FIREBASE_WEB_API_KEY}"
: "${NOVA_VPN_TLS_EMAIL:?set NOVA_VPN_TLS_EMAIL}"

CAPACITY_MBPS="${NOVA_VPN_CAPACITY_MBPS:-0}"
WG_PORT="${NOVA_VPN_WG_PORT:-51820}"
API_PORT="${NOVA_VPN_API_PORT:-8787}"
WG_NET4="${NOVA_VPN_IPV4_NET:-10.77.0.0/24}"
WG_NET6="${NOVA_VPN_IPV6_NET:-fd42:77::/64}"
WG_ADDR4="${WG_NET4%0/24}1/24"
WG_ADDR6="${WG_NET6%::/64}::1/64"
EGRESS_IF="$(ip route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="dev") {print $(i+1); exit}}')"

if ! [[ "$CAPACITY_MBPS" =~ ^[0-9]{1,6}$ ]] || (( CAPACITY_MBPS != 0 && (CAPACITY_MBPS < 100 || CAPACITY_MBPS > 100000) )); then
  echo "NOVA_VPN_CAPACITY_MBPS must be 0 (unverified) or a verified value from 100 to 100000" >&2
  exit 1
fi

if [[ -z "$EGRESS_IF" ]]; then
  echo "Could not determine VPS egress interface" >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y wireguard wireguard-tools nftables unbound nginx certbot python3-certbot-nginx python3 ca-certificates curl

install -d -m 700 /etc/wireguard /var/lib/nova-vpn /opt/nova-vpn

if [[ ! -s /etc/wireguard/server_private.key ]]; then
  umask 077
  wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
fi
SERVER_PRIVATE_KEY="$(cat /etc/wireguard/server_private.key)"

cat >/etc/wireguard/wg0.conf <<EOF
[Interface]
PrivateKey = ${SERVER_PRIVATE_KEY}
Address = ${WG_ADDR4}, ${WG_ADDR6}
ListenPort = ${WG_PORT}
SaveConfig = false
EOF
chmod 600 /etc/wireguard/wg0.conf /etc/wireguard/server_private.key /etc/wireguard/server_public.key

cat >/etc/sysctl.d/99-nova-vpn.conf <<'EOF'
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.core.netdev_max_backlog=8192
net.ipv4.conf.all.rp_filter=0
net.ipv4.conf.default.rp_filter=0
EOF
sysctl --system >/dev/null

cat >/etc/nftables.conf <<EOF
#!/usr/sbin/nft -f
flush ruleset

table inet nova_vpn_filter {
  chain forward {
    type filter hook forward priority 0; policy drop;
    ct state established,related accept
    iifname "wg0" oifname "${EGRESS_IF}" accept
    iifname "${EGRESS_IF}" oifname "wg0" ct state established,related accept
  }
}

table ip nova_vpn_nat4 {
  chain postrouting {
    type nat hook postrouting priority 100; policy accept;
    oifname "${EGRESS_IF}" ip saddr ${WG_NET4} masquerade
  }
}

table ip6 nova_vpn_nat6 {
  chain postrouting {
    type nat hook postrouting priority 100; policy accept;
    oifname "${EGRESS_IF}" ip6 saddr ${WG_NET6} masquerade
  }
}
EOF
systemctl enable --now nftables

cat >/etc/unbound/unbound.conf.d/nova-vpn.conf <<EOF
server:
  interface: 10.77.0.1
  interface: fd42:77::1
  access-control: ${WG_NET4} allow
  access-control: ${WG_NET6} allow
  hide-identity: yes
  hide-version: yes
  qname-minimisation: yes
  prefetch: yes
  rrset-roundrobin: yes
  cache-min-ttl: 60
  cache-max-ttl: 86400
EOF
systemctl restart unbound

install -m 755 "$(dirname "$0")/nova-vpn-node.py" /opt/nova-vpn/nova-vpn-node.py

cat >/etc/nova-vpn-node.env <<EOF
NOVA_VPN_NODE_ID=${NOVA_VPN_NODE_ID}
NOVA_VPN_PUBLIC_HOST=${NOVA_VPN_PUBLIC_HOST}
NOVA_VPN_CITY=${NOVA_VPN_CITY}
NOVA_VPN_COUNTRY=${NOVA_VPN_COUNTRY}
NOVA_VPN_CAPACITY_MBPS=${CAPACITY_MBPS}
NOVA_FIREBASE_WEB_API_KEY=${NOVA_FIREBASE_WEB_API_KEY}
NOVA_VPN_WG_INTERFACE=wg0
NOVA_VPN_WG_PORT=${WG_PORT}
NOVA_VPN_API_PORT=${API_PORT}
NOVA_VPN_IPV4_NET=${WG_NET4}
NOVA_VPN_IPV6_NET=${WG_NET6}
EOF
chmod 600 /etc/nova-vpn-node.env

cat >/etc/systemd/system/nova-vpn-node.service <<'EOF'
[Unit]
Description=Nova VPN WireGuard lease service
After=network-online.target wg-quick@wg0.service unbound.service
Wants=network-online.target
Requires=wg-quick@wg0.service

[Service]
Type=simple
EnvironmentFile=/etc/nova-vpn-node.env
ExecStart=/usr/bin/python3 /opt/nova-vpn/nova-vpn-node.py
Restart=always
RestartSec=2
NoNewPrivileges=false
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=/var/lib/nova-vpn /etc/wireguard

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/nginx/sites-available/nova-vpn <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${NOVA_VPN_PUBLIC_HOST};

  location / {
    proxy_pass http://127.0.0.1:${API_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_connect_timeout 3s;
    proxy_read_timeout 15s;
    client_max_body_size 32k;
  }
}
EOF
ln -sfn /etc/nginx/sites-available/nova-vpn /etc/nginx/sites-enabled/nova-vpn
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

systemctl enable --now wg-quick@wg0
systemctl enable --now nova-vpn-node

# DNS must already point NOVA_VPN_PUBLIC_HOST to this VPS before this succeeds.
certbot --nginx -d "${NOVA_VPN_PUBLIC_HOST}" --non-interactive --agree-tos -m "${NOVA_VPN_TLS_EMAIL}" --redirect

# fq keeps queues short under load; this is safe to re-run.
tc qdisc replace dev "${EGRESS_IF}" root fq 2>/dev/null || true

systemctl restart nova-vpn-node nginx

echo "Nova VPN node ready"
echo "Node: ${NOVA_VPN_NODE_ID}"
echo "Host: ${NOVA_VPN_PUBLIC_HOST}"
echo "WireGuard UDP: ${WG_PORT}"
if (( CAPACITY_MBPS > 0 )); then
  echo "Verified capacity: ${CAPACITY_MBPS} Mbps"
else
  echo "Capacity: unverified (benchmark before publishing)"
fi
echo "Health: https://${NOVA_VPN_PUBLIC_HOST}/health"
