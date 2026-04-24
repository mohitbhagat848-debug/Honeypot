"""
Optional local microservice: parse raw Ethernet/IP bytes with Scapy.
Defensive / lab use only — bind to 127.0.0.1.
"""
import base64
from flask import Flask, request, jsonify

app = Flask(__name__)

try:
    from scapy.all import Ether, IP, TCP, UDP, Raw  # type: ignore
except ImportError:
    Ether = IP = TCP = UDP = Raw = None  # type: ignore


@app.post("/parse")
def parse_frame():
    if Ether is None:
        return jsonify({"error": "scapy not installed"}), 500
    data = request.get_json(silent=True) or {}
    b64 = data.get("raw_base64")
    if not b64:
        return jsonify({"error": "raw_base64 required"}), 400
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return jsonify({"error": "invalid base64"}), 400

    layers = []
    p = Ether(raw)
    cur = p
    while cur:
        layers.append(cur.__class__.__name__)
        cur = cur.payload if hasattr(cur, "payload") and cur.payload else None

    summary = {"layers": layers, "len": len(raw)}
    if p.haslayer(IP):
        ip = p[IP]
        summary["src"] = ip.src
        summary["dst"] = ip.dst
    if p.haslayer(TCP):
        t = p[TCP]
        summary["sport"] = int(t.sport)
        summary["dport"] = int(t.dport)
    if p.haslayer(UDP):
        u = p[UDP]
        summary["sport"] = int(u.sport)
        summary["dport"] = int(u.dport)
    if p.haslayer(Raw):
        summary["payload_preview"] = bytes(p[Raw].load)[:64].hex()

    return jsonify(summary)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5055, debug=False)
