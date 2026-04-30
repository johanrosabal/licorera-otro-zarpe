'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Check, X, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export function LocationPicker({ initialCoords, onConfirm, onCancel }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const defaultCoords = initialCoords || { lat: 9.9333, lng: -84.0833 };
  const [position, setPosition] = useState(defaultCoords);
  const [searchQuery, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet map imperatively — this avoids react-leaflet's ref
  // callback which is incompatible with React 18 StrictMode double-invoke.
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let map;
    let marker;

    // Dynamically import Leaflet so it never runs on the server
    import('leaflet').then((L) => {
      // Guard: element may have been removed before the async import resolved
      if (!mapContainerRef.current) return;

      // Guard: another invocation may have already initialised the map
      if (mapContainerRef.current._leaflet_id) return;

      const icon = L.icon({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      map = L.map(mapContainerRef.current).setView(
        [defaultCoords.lat, defaultCoords.lng],
        15
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      marker = L.marker([defaultCoords.lat, defaultCoords.lng], { icon, draggable: true }).addTo(map);

      // Update position when user drags the marker
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        setPosition({ lat, lng });
      });

      // Also allow clicking on the map to move the marker
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setPosition({ lat, lng });
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker in sync when position changes via search
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([position.lat, position.lng]);
      mapInstanceRef.current.setView([position.lat, position.lng]);
    }
  }, [position]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=cr`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result) => {
    const newPos = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setPosition(newPos);
    setSearchResults([]);
    setSearchTerm(result.display_name);
  };

  return (
    <Card className="w-full overflow-hidden border-2 border-primary/20 shadow-xl">
      <CardContent className="p-0 relative">
        <div className="p-4 bg-muted/50 border-b flex flex-col gap-2">
          <form onSubmit={handleSearch} className="flex gap-2 relative">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Busca tu dirección..."
                value={searchQuery}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-12"
              />
            </div>
            <Button type="submit" disabled={isSearching}>
              {isSearching ? <Loader2 className="animate-spin" /> : 'BUSCAR'}
            </Button>

            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border shadow-2xl rounded-lg max-h-60 overflow-y-auto z-[2000] p-1">
                {searchResults.map((result, i) => (
                  <button
                    key={`res-${i}`}
                    type="button"
                    className="w-full text-left p-3 hover:bg-muted text-sm border-b last:border-0 rounded-md transition-colors"
                    onClick={() => selectSearchResult(result)}
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        <div className="h-[400px] w-full relative bg-muted">
          {!mapReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground z-10">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Inicializando mapa...</p>
            </div>
          )}
          {/* This div is always rendered so the ref is stable */}
          <div ref={mapContainerRef} className="h-full w-full z-0" />
        </div>

        <div className="p-4 bg-background border-t flex gap-2">
          <Button variant="outline" className="flex-1 font-bold h-12" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" /> CANCELAR
          </Button>
          <Button className="flex-1 font-black h-12 text-lg shadow-lg" onClick={() => onConfirm(position)}>
            <Check className="mr-2 h-5 w-5" /> CONFIRMAR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
