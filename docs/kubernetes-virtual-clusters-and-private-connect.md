# Virtual Kubernetes Clusters with Private Connect

Use Private Connect to give a multicluster Kubernetes API server and distributed nodes secure, bidirectional connectivity, no VPN, no same-network requirement. Works with **[kplane](https://github.com/kplane-dev/kplane)** (CLI for virtual control planes) and the **[kplane apiserver](https://github.com/kplane-dev/apiserver)** (shared, path-scoped API server).

---

## The Problem

Virtual or multicluster Kubernetes setups (e.g. one shared API server, many logical clusters, nodes in different regions) need:

- **Control plane ↔ nodes**: API server reachable by every node; nodes reachable by the control plane (e.g. kubelet, metrics).
- **Bidirectional**: Traffic both ways over private links.
- **Any location**: Nodes (and control plane) can be in different clouds, regions, or behind firewalls.

Usually that means a VPN or a single virtual private network. VPNs add ops overhead, IP planning, and sometimes latency. You want **private tunnels by name** instead.

---

## The Solution: Private Connect

Private Connect gives you **service-level tunnels by name**. Run an agent on the API server host and on each node (or VM); expose what the other side needs; reach by name. No VPN, no firewall rules, no port forwarding.

```
┌─────────────────────┐         ┌───────┐         ┌─────────────────────┐
│  Node A (region 1)  │────────▶│  Hub  │◀────────│  Multicluster API    │
│  connect reach k8s-api │      └───────┘         │  connect expose 6443 │
└─────────────────────┘                           └─────────────────────┘
         ▲                                                 │
         │                                                 ▼
         │         ┌───────┐         ┌─────────────────────┐
         └─────────│  Hub  │◀────────│  Node B (region 2)  │
                   └───────┘         │  connect reach k8s-api │
                                    └─────────────────────┘
```

- **API server** exposes its secure port (e.g. 6443) as a named service (e.g. `k8s-api`).
- **Nodes** run `connect reach k8s-api` and get a local port that tunnels to the API server.
- **Control plane → nodes**: If the API server needs to reach node endpoints (e.g. kubelet), run an agent on each node, expose those endpoints by name, and reach them from the API server host.

Everything is outbound to the hub; no open ports. Works with [kplane-dev/apiserver](https://github.com/kplane-dev/apiserver) or any multicluster/virtual Kubernetes API server.

---

## With kplane (recommended)

**[kplane](https://github.com/kplane-dev/kplane)** is a CLI for creating virtual Kubernetes control planes (VCPs). Each VCP is served by a shared API server with path-based isolation (`/clusters/<name>/control-plane`). The flow is kind-like: bring up the management plane, create a cluster, get credentials.

**kplane + Private Connect:**

1. **Create a virtual cluster** (local management plane + VCP):

   ```bash
   # Install kplane: curl -fsSL https://raw.githubusercontent.com/kplane-dev/kplane/main/scripts/install.sh | sh
   kplane up
   kplane create cluster demo
   kplane get-credentials demo
   kubectl get ns   # verify
   kubectl cluster-info   # shows apiserver URL, e.g. https://127.0.0.1:8443/clusters/demo/control-plane
   ```

2. **Expose the API server by name** so nodes (or your laptop) can reach it from anywhere:

   On the machine where kplane is running, get the apiserver port from `kubectl cluster-info`:

   ```text
   Kubernetes control plane is running at https://127.0.0.1:8443/clusters/demo1/control-plane
   ```

   Expose that port (e.g. `8443`), then reach by name from elsewhere:

   ```bash
   connect up
   connect expose localhost:8443 --name demo
   ```

3. **Reach from elsewhere** (another machine, region, or future worker node):

   ```bash
   connect reach demo
   # Point kubeconfig at https://127.0.0.1:<reached-port>/clusters/demo/control-plane (same path as cluster-info)
   ```

When kplane adds **worker node management (join/leave)**, nodes will need to reach the control plane. Private Connect (or WireGuard, Tailscale, Datum) can be the transport: each node runs `connect reach <cluster-name>` and talks to the API over the tunnel. No VPN, no open ports.

---

## Quick Start: API Server + One Node

### 1. Run the API server (control plane host)

Use your multicluster API server (e.g. [kplane-dev/apiserver](https://github.com/kplane-dev/apiserver)):

```bash
# Example: etcd + apiserver (see apiserver README for full flags)
./apiserver --etcd-servers=http://127.0.0.1:2379 --secure-port=6443 ...
```

Install Private Connect and expose the API server:

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
connect expose localhost:6443 --name k8s-api
```

### 2. Run a “node” (another machine / region)

On the machine that will act as a node (or run kubelet):

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
connect reach k8s-api --port 6443
```

Use `localhost:6443` (or the port you chose) as the API server address. The node talks to the control plane over Private Connect; no VPN required.

### 3. Bidirectional: control plane reaching nodes

If the API server (or other control-plane components) must reach node endpoints (e.g. kubelet read-only port, metrics):

**On each node:**

```bash
connect expose localhost:10250 --name node-<name>
```

**On the API server host:**

```bash
connect reach node-<name>
```

Then point your control plane at the local port Private Connect provides.

---

## Persistent Setup (daemon)

For long-lived clusters, run the agent as a daemon on each host:

```bash
# On API server host
connect daemon install
connect expose localhost:6443 --name k8s-api

# On each node
connect daemon install
connect reach k8s-api --port 6443
# Optionally expose node endpoints:
connect expose localhost:10250 --name node-us-west-1
```

Tunnels stay up and reconnect automatically.

---

## Non-interactive / automation

For CI, VMs, or scripts (e.g. cloud-init, exe.dev):

```bash
# On API server host
connect up --api-key pc_xxx --label k8s-control-plane
connect expose localhost:6443 --name k8s-api

# On nodes
connect up --api-key pc_xxx --label k8s-node-1
connect reach k8s-api --port 6443
```

Use the same workspace API key so all agents can see the same services.

---

## Summary

| Goal                         | With Private Connect                    |
|-----------------------------|-----------------------------------------|
| Nodes reach API server      | `connect reach k8s-api` on each node     |
| API server reach nodes      | Expose node endpoints, `connect reach` from control plane |
| No VPN                      | Outbound-only agents; no firewall rules |
| Any location                | Works across regions, clouds, NAT       |
| By name                     | Use `k8s-api`, `node-*` instead of IPs   |

---

## See also

- [kplane-dev/kplane](https://github.com/kplane-dev/kplane) — CLI for creating virtual Kubernetes control planes (kind-like)
- [kplane-dev/apiserver](https://github.com/kplane-dev/apiserver) — multicluster Kubernetes API server with path-based cluster routing
- [Tailscale and Private Connect](tailscale-and-private-connect.md) — K8s service access from outside the cluster
- [exe.dev and Private Connect](exe-dev-private-access.md) — private access from exe.dev VMs
