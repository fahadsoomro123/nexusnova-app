# Nova VPN — Oracle Cloud Always Free

Oracle Cloud is the preferred no-monthly-cost production host for the first Nova VPN node.

## Why this target

- OCI Always Free Ampere A1 compute can be used within the current Free Tier limits.
- For an Always Free tenancy, keep total Ampere A1 usage at or below 2 OCPUs and 12 GB RAM.
- Use one 2 OCPU / 12 GB Ubuntu 24.04 LTS VM for the first node. This gives the first VPN node the full free CPU/RAM allowance instead of splitting it across weak instances.
- Oracle currently provides a large free outbound data allowance, which is much more suitable for a VPN than micro free tiers with tiny egress quotas.

## One-time Oracle console work

1. Create an Oracle Cloud Free Tier account. Do not upgrade to paid unless explicitly intended.
2. Choose the home region carefully because Always Free compute is tied to the home region.
3. Create an Ampere A1 Flex VM with:
   - Ubuntu 24.04 LTS
   - 2 OCPU
   - 12 GB RAM
   - Always Free eligible shape
   - public IPv4
   - IPv6 enabled where available
   - at least 50 GB boot volume within the free storage allowance
4. Add ingress rules:
   - TCP 22 from the administrator's trusted address only
   - TCP 80 from anywhere (certificate bootstrap)
   - TCP 443 from anywhere (Nova VPN API/health)
   - UDP 51820 from anywhere (WireGuard)
5. Add an A/AAAA DNS record such as `node-1.vpn.nexusnovatools.com` pointing to the VM.
6. Put the deployment SSH private key and NexusNova server values in GitHub Actions secrets. Never commit private keys, Firebase API credentials, or SSH keys to the repository.

## GitHub deployment workflow

Run `.github/workflows/nova-vpn-deploy-existing-vps.yml` using workflow_dispatch after the VM and DNS exist.

The workflow uploads the canonical `vpn-infra/node` software and runs `bootstrap.sh`. That installs WireGuard, nftables forwarding/NAT, Unbound tunnel DNS, HTTPS, the authenticated peer-lease service, systemd units, and queue tuning.

Required repository secrets:

- `NOVA_VPN_SSH_PRIVATE_KEY`
- `NOVA_FIREBASE_WEB_API_KEY`
- `NOVA_VPN_TLS_EMAIL`

The workflow does not create an Oracle account or bypass Oracle verification. It deploys only to a VPS that the account owner has legitimately created.

## First production node target

Recommended first node sizing: 2 OCPU / 12 GB A1 Flex. Do not advertise a fixed Mbps value until the deployed node is benchmarked. The Nova VPN catalog should publish measured/verified capacity, latency, and health rather than invented speed claims.

After `/health` is HTTP 200 and authenticated `/v1/lease` works, add the node to `nexusnovatools.com/vpn/servers.json`. The Android Nova VPN client will then see it without an APK update.
