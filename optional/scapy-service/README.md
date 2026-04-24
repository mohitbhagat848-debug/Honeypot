# Optional Scapy microservice

This folder is an **extension point** for offline or lab packet analysis. It is **not required** for the main honeypot dashboard.

## Idea

Run a small Python service that accepts a **base64-encoded PCAP slice** or raw frame bytes and returns Scapy layer summaries (for correlation with HTTP honeypot logs in your own pipeline).

## Setup (optional)

```bash
cd optional/scapy-service
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python main.py
```

## Security

- Bind to `127.0.0.1` only.
- Do not expose this service to the public internet without authentication.

The stock Node stack does **not** call this service; integrate it manually if your research workflow needs packet-level context.
