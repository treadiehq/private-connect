# Virtual Kubernetes Clusters + Private Connect — Recipe

Quick command sequence to try a multicluster API server with Private Connect (e.g. [kplane-dev/apiserver](https://github.com/kplane-dev/apiserver)).

---

## Prerequisites

- [kplane-dev/apiserver](https://github.com/kplane-dev/apiserver) built (or its binary)
- etcd running (e.g. `docker run ... bitnami/etcd:3.5`)
- Private Connect account and API key from [privateconnect.co](https://privateconnect.co)

---

## Option A: API server + one “node” on two machines

### Machine 1 (control plane)

```bash
# 1. Start etcd (if not already)
docker run --rm -p 2379:2379 -e ALLOW_NONE_AUTHENTICATION=yes \
  -e ETCD_ADVERTISE_CLIENT_URLS=http://127.0.0.1:2379 \
  -e ETCD_LISTEN_CLIENT_URLS=http://0.0.0.0:2379 \
  bitnami/etcd:3.5

# 2. Start multicluster API server (in another shell)
./apiserver \
  --etcd-servers=http://127.0.0.1:2379 \
  --service-cluster-ip-range=10.0.0.0/24 \
  --allow-privileged=true \
  --authorization-mode=AlwaysAllow \
  --anonymous-auth=true \
  --secure-port=6443

# 3. Private Connect: expose API server
curl -fsSL https://privateconnect.co/install.sh | bash
connect up --api-key YOUR_API_KEY --label k8s-control-plane
connect expose localhost:6443 --name k8s-api
```

### Machine 2 (node)

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up --api-key YOUR_API_KEY --label k8s-node-1
connect reach k8s-api --port 6443
# Use localhost:6443 as API server (e.g. kubeconfig server: https://127.0.0.1:6443)
```

---

## Option B: All on one machine (two terminals)

Useful for a quick local demo: API server in one terminal, “node” in another using `connect reach k8s-api`.

### Terminal 1

```bash
# etcd + apiserver (as above), then:
connect up
connect expose localhost:6443 --name k8s-api
```

### Terminal 2

```bash
connect up   # same workspace
connect reach k8s-api --port 6443
# Probe: curl -k https://127.0.0.1:6443/clusters/root/control-plane/readyz
```

---

## Links

- Full guide: [docs/kubernetes-virtual-clusters-and-private-connect.md](../docs/kubernetes-virtual-clusters-and-private-connect.md)
- [kplane-dev/apiserver](https://github.com/kplane-dev/apiserver)
- [Private Connect](https://privateconnect.co)
