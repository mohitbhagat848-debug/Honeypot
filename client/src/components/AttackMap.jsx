import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function FitBounds({ points }) {
  const map = useMap();
  const [hasFitted, setHasFitted] = useState(false);

  useEffect(() => {
    if (!points.length || hasFitted) return;
    
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 8);
    } else {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
      map.fitBounds(b, { padding: [50, 50], maxZoom: 12 });
    }
    setHasFitted(true);
  }, [map, points, hasFitted]);

  return null;
}

function riskColor(r) {
  if (r?.classification === "malicious") return { stroke: "#ff4444", fill: "#ff4444" };
  if (r?.classification === "suspicious") return { stroke: "#ffb020", fill: "#ffb020" };
  return { stroke: "#00d4aa", fill: "#00d4aa" };
}

/* Pulsing circle effect via CSS class */
function PulsingMarker({ center, color, radius, children, onClick }) {
  return (
    <>
      <CircleMarker
        center={center}
        radius={radius + 4}
        pathOptions={{
          color: "transparent",
          fillColor: color,
          fillOpacity: 0.15,
          weight: 0,
        }}
        className="pulse-ring"
      />
      <CircleMarker
        center={center}
        radius={radius}
        eventHandlers={onClick ? { click: onClick } : undefined}
        pathOptions={{
          color: color,
          fillColor: color,
          fillOpacity: 0.7,
          weight: 2,
        }}
      >
        {children}
      </CircleMarker>
    </>
  );
}

export default function AttackMap({ logs, analystLocation = null, onPick = null, height = "h-72" }) {
  const points = (logs || [])
    .filter((l) => typeof l.lat === "number" && typeof l.lon === "number")
    .slice(0, 100);

  const fitPoints =
    analystLocation && typeof analystLocation.lat === "number" && typeof analystLocation.lon === "number"
      ? [...points, analystLocation]
      : points;

  return (
    <div className={`rounded-xl border border-cyber-border overflow-hidden ${height} relative map-reveal`}>
      <MapContainer center={[25, 10]} zoom={2} className="h-full w-full" scrollWheelZoom={true} zoomControl={true}>
        <LayersControl position="topright">
          {/* Dark theme base — with labels */}
          <LayersControl.BaseLayer checked name="Dark Matter (Premium)">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>

          {/* Midnight Blue theme */}
          <LayersControl.BaseLayer name="Midnight Blue">
            <TileLayer
              attribution='&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a>'
              url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>

          {/* Standard OpenStreetMap — full labels and streets */}
          <LayersControl.BaseLayer name="Standard">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          {/* Satellite view — real imagery */}
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          {/* Terrain / topo view */}
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          {/* Labels overlay — place names, streets, borders on satellite */}
          <LayersControl.Overlay checked name="Labels">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              pane="overlayPane"
            />
          </LayersControl.Overlay>
        </LayersControl>

        {fitPoints.length > 0 && <FitBounds points={fitPoints} />}

        {points.map((l, i) => {
          const col = riskColor(l);
          const radius = 5 + Math.min((l.riskScore || 0) / 12, 12);
          return (
            <PulsingMarker
              key={l._id || i}
              center={[l.lat, l.lon]}
              radius={radius}
              color={col.fill}
              onClick={onPick ? () => onPick(l) : undefined}
            >
              <Popup className="attack-popup">
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", minWidth: "220px", lineHeight: "1.6" }}>
                  <div style={{ fontWeight: 700, color: col.fill, fontSize: "13px", marginBottom: "6px" }}>
                    {l.ip || l.clientPublicIp || "Unknown IP"}
                  </div>
                  {l.clientPublicIp && l.clientPublicIp !== l.ip && (
                    <div style={{ color: "#aaa", fontSize: "11px", marginBottom: "4px" }}>
                      Public: <span style={{ color: "#00d4aa" }}>{l.clientPublicIp}</span>
                    </div>
                  )}
                  <div style={{ color: "#ccc" }}>
                    📍 {[l.city, l.regionName, l.country].filter(Boolean).join(", ") || "Unknown location"}
                  </div>
                  {typeof l.lat === "number" && (
                    <div style={{ color: "#888", fontSize: "11px" }}>
                      {l.lat.toFixed(4)}, {l.lon.toFixed(4)}
                    </div>
                  )}
                  {l.isp && <div style={{ color: "#aaa", marginTop: "4px" }}>ISP: {l.isp}</div>}
                  {l.org && l.org !== l.isp && <div style={{ color: "#aaa" }}>Org: {l.org}</div>}
                  <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{
                      background: l.classification === "malicious" ? "rgba(255,68,68,0.2)" : l.classification === "suspicious" ? "rgba(255,176,32,0.2)" : "rgba(0,212,170,0.2)",
                      color: col.fill,
                      padding: "2px 7px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      border: `1px solid ${col.fill}40`
                    }}>
                      {l.classification || "normal"}
                    </span>
                    {l.riskScore > 0 && (
                      <span style={{ background: "rgba(255,255,255,0.1)", padding: "2px 7px", borderRadius: "10px", fontSize: "10px", color: "#aaa" }}>
                        Risk: {l.riskScore}
                      </span>
                    )}
                    {l.isProxy && <span style={{ background: "rgba(255,176,32,0.2)", color: "#ffb020", padding: "2px 7px", borderRadius: "10px", fontSize: "10px" }}>Proxy</span>}
                    {l.isHosting && <span style={{ background: "rgba(255,92,92,0.2)", color: "#ff5c5c", padding: "2px 7px", borderRadius: "10px", fontSize: "10px" }}>Hosting/VPN</span>}
                  </div>
                  {(l.attackTypes || []).length > 0 && (
                    <div style={{ marginTop: "6px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {l.attackTypes.slice(0, 4).map((t, idx) => (
                        <span key={idx} style={{ background: "rgba(255,68,68,0.15)", color: "#ff6b6b", padding: "1px 6px", borderRadius: "8px", fontSize: "9px", border: "1px solid rgba(255,68,68,0.3)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {l.geoSource && (
                    <div style={{ color: "#555", fontSize: "10px", marginTop: "4px" }}>
                      via {l.geoProvider || l.geoSource} {l.geoAccuracy ? `· ±${Math.round(l.geoAccuracy)}m` : ""}
                    </div>
                  )}
                </div>
              </Popup>
            </PulsingMarker>
          );
        })}

        {analystLocation && typeof analystLocation.lat === "number" && typeof analystLocation.lon === "number" && (
          <CircleMarker
            center={[analystLocation.lat, analystLocation.lon]}
            radius={10}
            pathOptions={{
              color: "#58a6ff",
              fillColor: "#58a6ff",
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "monospace", fontSize: "12px" }}>
                <strong style={{ color: "#58a6ff" }}>📡 Your location</strong>
                <br />
                Accuracy: ±{Math.round(analystLocation.accuracy || 0)}m
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
