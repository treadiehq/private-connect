# Private Connect for AI Teams

**The service layer for AI development infrastructure.**

How AI teams access GPU clusters, model APIs, and training services, without VPN headaches.

> VPN is too slow for AI teams. Private Connect isn't.

---

## The problem

AI teams move fast. You're spinning up GPU clusters, deploying model APIs, iterating on training pipelines. Your infrastructure is exploding:

- GPU clusters across 3 regions
- Model registries (internal and external)
- Vector databases for RAG
- Experiment tracking (MLflow, Weights & Biases)
- Training APIs and inference endpoints
- Jupyter servers on beefy machines

And then someone new joins the team.

**The old way:**
1. "Submit a VPN access request"
2. "Here's the bastion host SSH key"
3. "Forward these 6 ports..."
4. "Oh, the GPU cluster moved to a new IP"
5. 2 hours later: "Can someone help me? I still can't connect"

**The Private Connect way:**
```bash
connect clone alice
# → 6 services connected in 30 seconds
# → Ready to train
```

---

## Access AI infrastructure by name

Stop memorizing IPs and ports. Name your services once, reach them forever.

```bash
# On your GPU cluster node
connect expose localhost:8888 --name jupyter-gpu
connect expose localhost:6006 --name tensorboard
connect expose localhost:5000 --name mlflow

# On your inference server
connect expose localhost:8080 --name model-api
connect expose localhost:6333 --name qdrant

# From anywhere — your laptop, a coffee shop, another cloud
connect reach jupyter-gpu
connect reach model-api
connect reach qdrant
```

No VPN. No SSH tunnels. No port forwarding. Just:
```bash
connect reach <service-name>
```

---

## Onboard ML engineers in 30 seconds

New hire? Contractor joining for a project? Researcher collaborating for a week?

```bash
# Senior ML engineer
connect share
# → Share code: x7k9m2

# New teammate
connect join x7k9m2
# → ✓ jupyter-gpu → localhost:8888
# → ✓ tensorboard → localhost:6006
# → ✓ mlflow → localhost:5000
# → ✓ model-api → localhost:8080
# → ✓ qdrant → localhost:6333
# → Ready to work
```

Or even simpler:
```bash
# Clone a teammate's exact environment
connect clone alice
# → Same services, same ports, same everything
```

**Time saved:** 2 hours → 30 seconds

---

## Common AI infrastructure setups

### GPU cluster access

```bash
# On your GPU node (Lambda, RunPod, on-prem)
connect daemon install
connect expose localhost:8888 --name jupyter-a100
connect expose localhost:22 --name ssh-gpu  # if you need shell

# From your laptop
connect reach jupyter-a100
# → localhost:8888 — Jupyter on your A100, from anywhere
```

### Multi-region training

```bash
# US-West cluster
connect expose localhost:8888 --name train-west

# EU cluster  
connect expose localhost:8888 --name train-eu

# Asia cluster
connect expose localhost:8888 --name train-asia

# From your laptop — switch regions with one command
connect reach train-west
connect reach train-eu
connect reach train-asia
```

### RAG infrastructure

```bash
# Vector database
connect expose localhost:6333 --name qdrant
connect expose localhost:19530 --name milvus

# Embedding service
connect expose localhost:8080 --name embeddings-api

# Your app connects to localhost
# Private Connect routes to the real services
```

### Experiment tracking

```bash
# MLflow server
connect expose localhost:5000 --name mlflow

# Weights & Biases (self-hosted)
connect expose localhost:8080 --name wandb

# TensorBoard
connect expose localhost:6006 --name tensorboard

# Access from any machine
connect reach mlflow
open http://localhost:5000
```

### Model serving

```bash
# Inference endpoints
connect expose localhost:8080 --name llm-api
connect expose localhost:8081 --name vision-api
connect expose localhost:8082 --name embedding-api

# Load testing from your laptop
connect reach llm-api
curl http://localhost:8080/v1/completions -d '{"prompt": "Hello"}'
```

---

## Project-based environments

Define services per-project. Connect with one command.

```yaml
# ml-project/pconnect.yml
services:
  - name: jupyter-gpu
    port: 8888
  - name: mlflow
    port: 5000
  - name: tensorboard
    port: 6006
  - name: model-api
    port: 8080
  - name: qdrant
    port: 6333
```

```bash
cd ml-project
connect dev
# → All 5 services connected
# → Start training
```

---

## Why AI teams switch from VPN

| VPN | Private Connect |
|-----|-----------------|
| Request access, wait for IT | `connect up` — instant |
| IPs change, config breaks | Named services, always correct |
| Forward ports manually | Auto port binding |
| New hire = 2 hour setup | `connect clone teammate` = 30 seconds |
| One person's environment | Share with the whole team |
| Works on the office network | Works from anywhere |

---

## Security for AI infrastructure

AI infrastructure often has sensitive data, models, training data, embeddings. Private Connect is built for this:

- **No exposed ports** — services stay private
- **Encrypted tunnels** — all traffic is encrypted
- **Time-limited shares** — `connect share --expires 7d`
- **Instant revocation** — `connect share --revoke <code>`
- **Audit logs** — who accessed what, when

```bash
# Give a contractor access for 1 week
connect share --expires 7d
# → Share code: abc123

# Check active shares
connect share --list

# Revoke when done
connect share --revoke abc123
```

---

## Real workflow: Training a model remotely

```bash
# Morning: connect to your GPU cluster
connect reach jupyter-gpu

# Start a training run
# (in Jupyter, kick off training)

# Afternoon: check progress from your phone (via Termius + connect CLI)
connect reach tensorboard
# → localhost:6006 — training curves on your phone

# Evening: training done, check MLflow from home
connect reach mlflow
# → localhost:5000 — compare runs, pick best model

# Deploy: push to inference
connect reach model-api
curl -X POST localhost:8080/v1/models/deploy -d '{"run_id": "abc123"}'
```

Same workflow whether you're at the office, at home, or on a plane.

---

## For AI team leads

You have a team of 5-15 ML engineers. Each one needs access to:
- Shared GPU clusters
- Training infrastructure
- Model registries
- Experiment tracking

**Without Private Connect:**
- Maintain VPN configs
- Update SSH keys
- Answer "how do I connect to X?" daily
- Onboard new hires manually

**With Private Connect:**
```bash
# New hire
connect clone senior-ml-engineer
# → Done

# Contractor for 2 weeks
connect share --expires 14d
# → Done

# Check active shares
connect share --list
# → Share x7k9m2: expires in 13 days
# → Share abc123: expires in 6 days
```

---

## Get started

```bash
# Install
curl -fsSL https://privateconnect.co/install.sh | bash

# Authenticate
connect up

# Expose your first service
connect expose localhost:8888 --name jupyter-gpu

# Reach it from anywhere
connect reach jupyter-gpu
```

---

## The bottom line

AI teams are shipping faster than ever. Infrastructure access shouldn't be the bottleneck.

**Private Connect is the service layer for AI development infrastructure.** Access GPU clusters, model APIs, and training services by name, from anywhere. Onboard teammates in 30 seconds.

```bash
connect reach training-cluster
```

That's it. Start training.