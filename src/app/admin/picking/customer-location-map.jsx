'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

export default function CustomerLocationMap({ lat, lng }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [address, setAddress] = useState('Cargando dirección...');

  useEffect(() => {
    async function reverseGeocode() {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        setAddress(data.display_name || 'Dirección no encontrada');
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        setAddress('Error al obtener dirección');
      }
    }
    if (lat && lng) reverseGeocode();
  }, [lat, lng]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (!mapContainerRef.current || mapContainerRef.current._leaflet_id) return;

      const icon = L.icon({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      const map = L.map(mapContainerRef.current, {
        scrollWheelZoom: false,
        zoomControl: false,
      }).setView([lat, lng], 17);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      L.marker([lat, lng], { icon }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng]);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border-2 border-primary/10 overflow-hidden shadow-inner bg-muted">
          <div ref={mapContainerRef} className="h-[200px] w-full z-0" />
      </div>
      <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20 flex gap-2">
        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed font-medium text-muted-foreground">
          {address}
        </p>
      </div>
    </div>
  );
}
