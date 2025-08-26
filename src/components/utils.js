/**
 * Calculates the azimuth and elevation angle from a given point on Earth towards a satellite.
 * This calculation is based on converting geographic coordinates (latitude, longitude, altitude)
 * to Earth-Centered, Earth-Fixed (ECEF) Cartesian coordinates, and then rotating the
 * satellite vector into the observer's local coordinate frame (East-North-Up or ENU).
 *
 * @param {number} observerLatDeg - The observer's latitude in degrees.
 * @param {number} observerLngDeg - The observer's longitude in degrees.
 * @param {number} satelliteLatDeg - The satellite's latitude in degrees.
 * @param {number} satelliteLngDeg - The satellite's longitude in degrees.
 * @param {number} satelliteAltitudeKm - The satellite's altitude in kilometers.
 * @returns {{azimuth: number, elevation: number}} An object containing the azimuth and elevation in degrees.
 */
function calculateLookAngles(
  observerLatDeg,
  observerLngDeg,
  satelliteLatDeg,
  satelliteLngDeg,
  satelliteAltitudeKm
) {
  // === 1. Define Constants and Convert Angles to Radians ===

  // WGS 84 Earth's major axis and flattening factor
  const a = 6378.137; // Earth's major axis radius in km
  const f = 1 / 298.257223563; // Flattening factor
  const e2 = f * (2 - f); // Eccentricity squared

  // Convert all input angles from degrees to radians for calculations
  const observerLatRad = (observerLatDeg * Math.PI) / 180;
  const observerLngRad = (observerLngDeg * Math.PI) / 180;
  const satelliteLatRad = (satelliteLatDeg * Math.PI) / 180;
  const satelliteLngRad = (satelliteLngDeg * Math.PI) / 180;

  // === 2. Convert Observer's Geographic Coordinates to ECEF (Earth-Centered, Earth-Fixed) ===

//   const N_observer = a / Math.sqrt(1 - e2 * Math.sin(observerLatRad) ** 2);
//   const x_observer =
//     N_observer * Math.cos(observerLatRad) * Math.cos(observerLngRad);
//   const y_observer =
//     N_observer * Math.cos(observerLatRad) * Math.sin(observerLngRad);
//   const z_observer = N_observer * (1 - e2) * Math.sin(observerLatRad);

var obsECEF=geodeticToECEF(observerLatDeg, observerLngDeg, 0);
var  x_observer = obsECEF[0];
var  y_observer = obsECEF[1];
var  z_observer = obsECEF[2];
// console.log("OBSEERVER function",obsECEF);
// console.log("OBSEERVER  function internal",x_observer, y_observer, z_observer);


  // === 3. Convert Satellite's Geographic Coordinates to ECEF ===

//   const N_satellite = a / Math.sqrt(1 - e2 * Math.sin(satelliteLatRad) ** 2);
//   const x_satellite =
//     (N_satellite + satelliteAltitudeKm) *
//     Math.cos(satelliteLatRad) *
//     Math.cos(satelliteLngRad);
//   const y_satellite =
//     (N_satellite + satelliteAltitudeKm) *
//     Math.cos(satelliteLatRad) *
//     Math.sin(satelliteLngRad);
//   const z_satellite =
//     (N_satellite * (1 - e2) + satelliteAltitudeKm) * Math.sin(satelliteLatRad);

var satECEF=geodeticToECEF(satelliteLatDeg, satelliteLngDeg, satelliteAltitudeKm);
var  x_satellite = satECEF[0];
var  y_satellite = satECEF[1];
var  z_satellite = satECEF[2];  

// console.log("SAT function",satECEF);
// console.log("SAT function calculated ", x_satellite, y_satellite, z_satellite);


  // === 4. Calculate Vector from Observer to Satellite (in ECEF frame) ===

  const x_vector = x_satellite - x_observer;
  const y_vector = y_satellite - y_observer;
  const z_vector = z_satellite - z_observer;
   
  const distance = Math.sqrt(x_vector ** 2 + y_vector ** 2 + z_vector ** 2);


  // === 5. Rotate the Vector into the Observer's Local Tangent Plane (East-North-Up or ENU) ===

  const sinLat = Math.sin(observerLatRad);
  const cosLat = Math.cos(observerLatRad);
  const sinLng = Math.sin(observerLngRad);
  const cosLng = Math.cos(observerLngRad);

  // East vector component
  const east = -sinLng * x_vector + cosLng * y_vector;
  // North vector component
  const north =
    -cosLng * sinLat * x_vector -
    sinLng * sinLat * y_vector +
    cosLat * z_vector;
  // Up vector component
  const up =
    cosLng * cosLat * x_vector + sinLng * cosLat * y_vector + sinLat * z_vector;

  // === 6. Calculate Azimuth and Elevation from the ENU Vector ===

  // Elevation is the angle above the horizon. It's the arctangent of the 'Up' component divided by the horizontal magnitude.
  const elevationRad = Math.atan2(up, Math.sqrt(east ** 2 + north ** 2));

  // Azimuth is the compass bearing (0° = North, 90° = East). It's the arctangent of 'East' component over 'North'.
  const azimuthRad = Math.atan2(east, north);

  // === 7. Convert Results back to Degrees and Normalize ===

  let azimuthDeg = (azimuthRad * 180) / Math.PI;
  const elevationDeg = (elevationRad * 180) / Math.PI;

  // Normalize azimuth to be between 0 and 360 degrees
  if (azimuthDeg < 0) {
    azimuthDeg += 360;
  }

  return {
    azimuth: azimuthDeg,
    elevation: elevationDeg,
    distance:distance
  };
}



function geodeticToECEF(lat, lon, alt_km) {
  const a = 6378.137; // Earth equatorial radius km
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const x = (N + alt_km) * Math.cos(latRad) * Math.cos(lonRad);
  const y = (N + alt_km) * Math.cos(latRad) * Math.sin(lonRad);
  const z = (N * (1 - e2) + alt_km) * Math.sin(latRad);
  return [x, y, z];
}

function ecefToGeodetic(x, y, z) {
  const a = 6378.137;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const b = a * (1 - f);
  const ep = Math.sqrt((a * a - b * b) / (b * b));
  const p = Math.sqrt(x * x + y * y);
  let theta = Math.atan2(z * a, p * b);
  let sinTheta = Math.sin(theta);
  let cosTheta = Math.cos(theta);
  let lat = Math.atan2(
    z + ep * ep * b * sinTheta * sinTheta * sinTheta,
    p - e2 * a * cosTheta * cosTheta * cosTheta
  );
  let lon = Math.atan2(y, x);
  let N = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat));
  let alt = p / Math.cos(lat) - N;
  return [(lat * 180) / Math.PI, (lon * 180) / Math.PI, alt];
}




export {
   geodeticToECEF,
   ecefToGeodetic,
  // normalize,
  // dot,
  // cross,
  // rotateVector,
  // gainPatternGSO,
  // gainPatternMEO,
  // gainPatternLEO,
  // gainPatternSingleFeed,
  // gainPatternElliptical,
  // getGainAtAngle,
  // computeFootprintElliptical,
  // computeFootprint,
  // calculateFootprintArea,
  // destinationLatLon,
  // getProjectionConfig, 
  calculateLookAngles,
    
};
