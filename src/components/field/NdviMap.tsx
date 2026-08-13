import { MapContainer, Rectangle, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ndviTileUrl, trueColorTileUrl } from "@/lib/satellite";

type Props = {
  lat: number;
  lon: number;
  bbox: [number, number, number, number];
  itemUrl: string;
  layer: "ndvi" | "true";
  opacity: number;
};

export default function NdviMap({ lat, lon, bbox, itemUrl, layer, opacity }: Props) {
  const bounds: [[number, number], [number, number]] = [
    [bbox[1], bbox[0]],
    [bbox[3], bbox[2]],
  ];

  return (
    <MapContainer
      center={[lat, lon]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", background: "#0d1b12" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        maxZoom={19}
      />
      <TileLayer
        key={`${layer}-${itemUrl}`}
        url={layer === "ndvi" ? ndviTileUrl(itemUrl) : trueColorTileUrl(itemUrl)}
        opacity={opacity}
        maxNativeZoom={16}
        maxZoom={19}
        attribution="Copernicus Sentinel-2 (ESA) · NDVI rendered with TiTiler"
      />
      <Rectangle bounds={bounds} pathOptions={{ color: "#ffd166", weight: 2, fill: false, dashArray: "6 4" }} />
    </MapContainer>
  );
}
