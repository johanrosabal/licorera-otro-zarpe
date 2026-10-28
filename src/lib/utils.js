

import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount, useSymbol = true) {
  const options = {
    style: useSymbol ? 'currency' : 'decimal',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  
  // 'en-US' locale will use , for thousands and . for decimals, but will use the CRC symbol.
  const formatter = new Intl.NumberFormat('en-US', options);
  
  return formatter.format(amount || 0).replace('CRC', '₡');
}


/**
 * Formats a number or string into a currency format with commas for thousands and a period for decimals.
 * @param {string | number} value The value to format.
 * @returns {string} The formatted currency string.
 */
export function formatCurrencyInput(value) {
  if (value === null || value === undefined || value === '') return '';

  let stringValue = String(value);

  // Remove anything that's not a digit or a period
  stringValue = stringValue.replace(/[^0-9.]/g, '');

  const parts = stringValue.split('.');
  let integerPart = parts[0];
  let decimalPart = parts[1];

  // Format integer part with commas
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Truncate decimals to 2 places
  if (decimalPart) {
    decimalPart = decimalPart.substring(0, 2);
    return `${integerPart}.${decimalPart}`;
  }

  return integerPart;
}

/**
 * Parses a formatted currency string back into a number.
 * @param {string} value The formatted currency string.
 * @returns {number} The parsed number.
 */
export function parseFormattedCurrency(value) {
    if (typeof value !== 'string') {
        return value;
    }
    const cleanedValue = value.replace(/,/g, ''); // Remove commas
    return parseFloat(cleanedValue) || 0;
}

export const formatSinpeMovil = (value) => {
    if (!value) return value;
    const digits = value.replace(/\D/g, '');
    const truncatedDigits = digits.slice(0, 8);
    if (truncatedDigits.length > 4) {
        return `${truncatedDigits.slice(0, 4)}-${truncatedDigits.slice(4)}`;
    }
    return truncatedDigits;
};

/**
 * Formatea un número de teléfono con el formato de Costa Rica: (506) 0000 0000
 * @param {string} val
 * @returns {string} Teléfono formateado
 */
export function formatPhoneNumber(val) {
  if (!val) return '';
  if (val === '(506)' || val === '(506' || val === '(50' || val === '(' || val === '(5') {
    return '';
  }
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';

  if (digits === '506') {
    return val.endsWith(' ') ? '(506) ' : '';
  }

  let num = digits;
  if (digits.startsWith('506') && digits.length > 3) {
    num = digits.slice(3);
  }

  num = num.slice(0, 8);
  if (!num) return '';

  if (num.length <= 4) {
    return `(506) ${num}`;
  }
  return `(506) ${num.slice(0, 4)} ${num.slice(4)}`;
}

/**
 * Extrae latitud y longitud desde cualquier entrada:
 * - Links de Google Maps (place, @lat,lng, !3d/!4d, maps.app.goo.gl, search)
 * - Links de WhatsApp (maps.google.com/?q=..., loc:lat,lng)
 * - Links de Waze o Apple Maps (?ll=lat,lng o ?daddr=lat,lng)
 * - Coordenadas en texto plano: "10.008151, -84.122928"
 * - Coordenadas DMS: 10°00'29.3"N 84°07'22.5"W
 * 
 * @param {string} input - URL o texto con coordenadas
 * @returns {{ lat: number, lng: number } | null}
 */
export const extractCoordsFromUrl = (input) => {
    if (!input || typeof input !== 'string') return null;

    let text = input.trim();
    if (!text) return null;

    // Decodificar entidades URL si están codificadas (%C2%B0, %22, %20, etc.)
    try {
        text = decodeURIComponent(text);
    } catch (_) {}

    // 1. Google Maps pinned marker: !3d<lat> y !4d<lng>
    const latMatch = text.match(/!3d(-?\d+(?:\.\d+)?)/);
    const lngMatch = text.match(/!4d(-?\d+(?:\.\d+)?)/);
    if (latMatch && lngMatch) {
        const lat = parseFloat(latMatch[1]);
        const lng = parseFloat(lngMatch[1]);
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat, lng };
        }
    }

    // 2. Google Maps viewport/coordenadas con @lat,lng
    const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
        const lat = parseFloat(atMatch[1]);
        const lng = parseFloat(atMatch[2]);
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat, lng };
        }
    }

    // 3. Parámetros de consulta: q=lat,lng, query=lat,lng, ll=lat,lng, daddr=lat,lng (incluye WhatsApp loc:lat,lng)
    const queryMatch = text.match(/[?&](?:q|query|ll|daddr|saddr|destination)=(?:loc:)?(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/i);
    if (queryMatch) {
        const lat = parseFloat(queryMatch[1]);
        const lng = parseFloat(queryMatch[2]);
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat, lng };
        }
    }

    // 4. Formato DMS (Grados, Minutos, Segundos): ej. 10°00'29.3"N 84°07'22.5"W
    const dmsMatch = text.match(/(\d{1,2})[°\s]+(\d{1,2})['\s]+(\d+(?:\.\d+)?)["\s]*([NSns])[,\s+]+(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d+(?:\.\d+)?)["\s]*([EWew])/);
    if (dmsMatch) {
        const latDeg = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
        const lat = dmsMatch[4].toUpperCase() === 'S' ? -latDeg : latDeg;
        const lngDeg = parseFloat(dmsMatch[5]) + parseFloat(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600;
        const lng = dmsMatch[8].toUpperCase() === 'W' ? -lngDeg : lngDeg;
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
        }
    }

    // 5. Coordenadas decimales directas en texto: ej. "10.008151, -84.122928"
    const pairMatch = text.match(/(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
    if (pairMatch) {
        const lat = parseFloat(pairMatch[1]);
        const lng = parseFloat(pairMatch[2]);
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat, lng };
        }
    }

    return null;
};

/**
 * Calculates the distance between two geographical points using the Haversine formula.
 * @param {number} lat1 Latitude of point 1.
 * @param {number} lon1 Longitude of point 1.
 * @param {number} lat2 Latitude of point 2.
 * @param {number} lon2 Longitude of point 2.
 * @returns {number} The distance in kilometers.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
}
