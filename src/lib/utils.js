

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

export const extractCoordsFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;

    try {
        const urlObj = new URL(url);
        // For google.com/maps?q=lat,lng
        const q = urlObj.searchParams.get('q');
        if (q) {
            const [lat, lng] = q.split(',').map(s => s.trim());
            if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                return { lat: parseFloat(lat), lng: parseFloat(lng) };
            }
        }
        
        // For google.com/maps/place/.../@lat,lng,zoom
        const pathParts = urlObj.pathname.split('/');
        const atPart = pathParts.find(part => part.startsWith('@'));
        if (atPart) {
            const [lat, lng] = atPart.substring(1).split(',').map(s => s.trim());
             if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                return { lat: parseFloat(lat), lng: parseFloat(lng) };
            }
        }
    } catch (error) {
        // Not a valid URL, ignore
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
