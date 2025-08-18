import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import * as turf from '@turf/turf';

function geodeticToECEF(lat, lon, alt_km) {
  const a = 6378.137; // Earth equatorial radius km
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
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
  const ep = Math.sqrt((a*a - b*b) / (b*b));
  const p = Math.sqrt(x*x + y*y);
  let theta = Math.atan2(z * a, p * b);
  let sinTheta = Math.sin(theta);
  let cosTheta = Math.cos(theta);
  let lat = Math.atan2(z + ep*ep * b * sinTheta*sinTheta*sinTheta, p - e2 * a * cosTheta*cosTheta*cosTheta);
  let lon = Math.atan2(y, x);
  let N = a / Math.sqrt(1 - e2 * Math.sin(lat)*Math.sin(lat));
  let alt = p / Math.cos(lat) - N;
  return [lat * 180 / Math.PI, lon * 180 / Math.PI, alt];
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v*v, 0));
  return vec.map(v => v / norm);
}

function dot(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function rotateVector(v, k, rad) {
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const kDotV = dot(k, v);
  const crossKV = cross(k, v);
  return v.map((vi, i) =>
    vi * cosA + crossKV[i] * sinA + k[i] * kDotV * (1 - cosA)
  );
}

function cross(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0]
  ];
}

function gainPatternGSO(psiDeg, Gm, psi0, Ls) {
  const constants = { "-10": { a: 1.83, b: 6.32 }, "-20": { a: 2.58, b: 6.32 } };
  const params = constants[Ls.toString()];
  if (!params) return null;
  const { a, b } = params;
  const psiRel = psiDeg / psi0;
  if (psiRel <= a / 2) return Gm - 12 * (psiRel ** 2);
  if (psiRel <= b / 2) return Gm + Ls;
  return Gm + Ls + 20 - 25 * Math.log10(2 * psiRel);
}

function gainPatternMEO(psiDeg, Gm, Ls, psi_b, psi_z, gainFloor) {
  const Y = 2 * psi_b; // Boundary between main lobe and side lobe
  const Z = psi_z;     // Boundary between side lobe and far-out region

  if (psiDeg <= Y) {
    return Gm - 3 * (psiDeg / psi_b)**2;
  } else if (psiDeg <= Z) {
    return Gm + Ls - 25 * Math.log10(psiDeg / Y);
  } else {
    return gainFloor;
  }
}

function gainPatternLEO(psiDeg, Gm, Ls, psi_b, psi_z, gainFloor) {
  const Y = 1.5 * psi_b; // Boundary is 1.5x for LEO
  const Z = psi_z;
  if (psiDeg <= Y) return Gm - 3 * (psiDeg / psi_b)**2;
  if (psiDeg <= Z) return Gm + Ls - 25 * Math.log10(psiDeg / Y);
  return gainFloor;
}

function gainPatternSingleFeed(psiDeg, Gm, psi0, Ls) {
  const table = {
    "-20": { a: 2.58, b: 6.32 },
    "-25": { a: 2.88, b: 6.32 },
    "-30": { a: 3.16, b: 6.32 }
  };
  const params = table[Ls.toString()];
  if (!params) return null;
  
  const { a, b } = params;
  
  // Calculate psi1 where the third formula equals 0
  const psi1 = psi0 * (10**((Gm + Ls + 20) / 25));

  // A reasonable assumption for the main lobe (0 to psi0) is that the first formula applies.
  if (psiDeg < psi0) {
      return Gm - 3 * (psiDeg/psi0)**2;
  }
  // Region I from the document
  if (psiDeg <= a * psi0) {
      return Gm - 3 * (psiDeg/psi0)**2;
  }
  // Region II
  if (psiDeg <= b * psi0) {
      return Gm + Ls;
  }
  // Region III
  if (psiDeg <= psi1) {
      return Gm + Ls + 20 - 25 * Math.log10(psiDeg/psi0);
  }
  // Region IV
  return 0;
}

function gainPatternElliptical(thetaDeg, phiDeg, Gm, theta3dB, phi3dB) {
  const G0 = Gm; // Use Gm for consistency
  // The model simplifies to this single formula for the main lobe
  const gain = G0 - 12 * ( (thetaDeg / theta3dB)**2 + (phiDeg / phi3dB)**2 );
  return gain;
}

function getGainAtAngle(psi, controls) {
  if (controls.gainPatternType.startsWith("Single Feed")) { return gainPatternSingleFeed(psi, controls.Gm, controls.psi0, controls.Ls); }
  if (controls.gainPatternType.startsWith("MEO")) { return gainPatternMEO(psi, controls.Gm, controls.Ls, controls.psi_b, controls.psi_z, controls.gainFloor); }
  if (controls.gainPatternType.startsWith("LEO")) { return gainPatternLEO(psi, controls.Gm, controls.Ls, controls.psi_b, controls.psi_z, controls.gainFloor); }
  // Default to GSO
  return gainPatternGSO(psi, controls.Gm, controls.psi0, controls.Ls);
}

function computeFootprintElliptical(satECEF, boresight, controls, targetGain, nPoints = 360) {
  const { Gm, theta3dB, phi3dB } = controls;
  if (targetGain > Gm) return [];

  // Invert the gain formula to find the "equivalent psi squared" for the target gain
  const psi_squared = ((Gm - targetGain) / 12);
  if (psi_squared < 0) return []; // Target gain is too low for this model

  // Define the orthogonal axes for the ellipse plane
  const arbitraryVec = Math.abs(boresight[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const axis1 = normalize(cross(boresight, arbitraryVec)); // Corresponds to theta
  const axis2 = normalize(cross(boresight, axis1));       // Corresponds to phi

  let footprintPoints = [];
  for (let i = 0; i < nPoints; i++) {
    const alpha = 2 * Math.PI * i / nPoints; // Angle around the ellipse
    
    // Parametric equation for the ellipse in the (theta, phi) plane
    const theta_deg = Math.sqrt(psi_squared) * theta3dB * Math.cos(alpha);
    const phi_deg = Math.sqrt(psi_squared) * phi3dB * Math.sin(alpha);
    const theta_rad = theta_deg * Math.PI / 180;
    const phi_rad = phi_deg * Math.PI / 180;

    // Construct the off-axis ray vector using small-angle approximation, then normalize
    const dir = normalize([
      boresight[0] + axis1[0] * theta_rad + axis2[0] * phi_rad,
      boresight[1] + axis1[1] * theta_rad + axis2[1] * phi_rad,
      boresight[2] + axis1[2] * theta_rad + axis2[2] * phi_rad
    ]);
    
    const intersect = rayEarthIntersection(satECEF, dir);
    if (intersect) {
      const [lat, lon] = ecefToGeodetic(...intersect);
      footprintPoints.push([lat, lon]);
    }
  }
  return footprintPoints;
}

function findPsiForGain(controls, gain_dBi) {
  const maxPsi = 180;
  const step = 0.01;
  let psi = 0;
  while (psi <= maxPsi) {
    const gain = getGainAtAngle(psi, controls);
    if (gain !== null && gain <= gain_dBi) return psi;
    psi += step;
  }
  return maxPsi;
}

function rayEarthIntersection(rayOrigin, rayDir) {
  // Earth ellipsoid parameters
  const a = 6378.137; // equatorial radius km
  const f = 1 / 298.257223563;
  const b = a * (1 - f); // polar radius km
  // Quadratic form coefficients for intersection with ellipsoid
  // Ray: r = rayOrigin + t * rayDir
  // Ellipsoid: (x^2 + y^2)/a^2 + z^2/b^2 = 1
  const x0 = rayOrigin[0], y0 = rayOrigin[1], z0 = rayOrigin[2];
  const dx = rayDir[0], dy = rayDir[1], dz = rayDir[2];
  const A = (dx*dx + dy*dy) / (a*a) + (dz*dz) / (b*b);
  const B = 2 * ((x0*dx + y0*dy) / (a*a) + (z0*dz) / (b*b));
  const C = (x0*x0 + y0*y0) / (a*a) + (z0*z0) / (b*b) - 1;
  const discriminant = B*B - 4*A*C;
  if (discriminant < 0) return null; // no intersection
  // Two solutions for t
  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-B - sqrtDisc) / (2 * A);
  const t2 = (-B + sqrtDisc) / (2 * A);
  // Choose smallest positive t (closest intersection in front of ray)
  let t = null;
  if (t1 > 0 && t2 > 0) t = Math.min(t1, t2);
  else if (t1 > 0) t = t1;
  else if (t2 > 0) t = t2;
  else return null; // both behind origin
  return rayOrigin.map((v, i) => v + t * rayDir[i]);
}

function computeFootprint(satECEF, boresight, controls, targetGain_dBi, nPoints = 360) {
  const psiDeg = findPsiForGain(controls, targetGain_dBi);
  if (psiDeg === 180) return [];
  const psiRad = psiDeg * Math.PI / 180;
  let arbitraryVec = Math.abs(boresight[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let perpendicularVec = normalize(cross(boresight, arbitraryVec));
  let initialRay = rotateVector(boresight, perpendicularVec, psiRad);
  let footprintPoints = [];
  for (let i = 0; i < nPoints; i++) {
    const angle = 2 * Math.PI * i / nPoints;
    const dir = rotateVector(initialRay, boresight, angle);
    const intersect = rayEarthIntersection(satECEF, dir);
    if (intersect) {
      const [lat, lon] = ecefToGeodetic(...intersect);
      footprintPoints.push([lat, lon]);
    }
  }
  return footprintPoints;
}

function calculateFootprintArea(points) {
  if (!points || points.length < 3) return 0;
  const geoJsonCoords = points.map(([lat, lon]) => [lon, lat]);
  geoJsonCoords.push(geoJsonCoords[0]);
  const polygon = { type: "Polygon", coordinates: [geoJsonCoords] };
  const earthRadiusKm = 6371;
  const areaSteradians = d3.geoArea(polygon);
  return areaSteradians * earthRadiusKm * earthRadiusKm;
}

// footprints = {
//   const gains = [ controls.gain_dBi_1, controls.gain_dBi_2, controls.gain_dBi_3, controls.gain_dBi_4 ];
//   const satECEF = geodeticToECEF(controls.satelliteLat, controls.satelliteLon, controls.satelliteAlt);
//   const targetECEF = geodeticToECEF(controls.antennaLat, controls.antennaLon, 0);
//   const boresight = normalize(targetECEF.map((v, i) => v - satECEF[i]));
  
//   // Choose which footprint computer to use
//   const isElliptical = controls.gainPatternType.startsWith("Elliptical");
  
//   return gains.map((gain, index) => {
//     const effectiveGm = controls.Gm; if (gain > effectiveGm) { return { gain, index: index + 1, points: [], area_km2: 0 }; }
    
//     // Call the appropriate function based on the selected model
//     const points = isElliptical
//       ? computeFootprintElliptical(satECEF, boresight, controls, gain)
//       : computeFootprint(satECEF, boresight, controls, gain);
      
//     const area_km2 = calculateFootprintArea(points);
//     return { gain: gain, index: index + 1, points: points, area_km2: area_km2 };
//   });
// }

// function plotMultiGainMap(footprints, controls, world) {
//   const width=800,height=500,proj=d3.geoEquirectangular().scale(150).translate([width/2,height/2]), cont=d3.create("div").style("position","relative"), tip=cont.append("div").attr("class","map-tooltip").style("position","absolute").style("display","none").style("background","rgba(0,0,0,0.75)").style("color","white").style("padding","8px 12px").style("border-radius","4px").style("font-family","sans-serif").style("font-size","12px").style("pointer-events","none"), svg=cont.append(()=>d3.create("svg").attr("viewBox",[0,0,width,height]).attr("width",width).style("max-width","100%").style("height","auto").node()), path=d3.geoPath(proj), colors=["#ff0000","#ffa500","#ffff00","#00ff00","#0000ff"];
//   svg.append("rect").attr("width",width).attr("height",height).attr("fill","#e6f3ff"); svg.append("path").datum(d3.geoGraticule()).attr("fill","none").attr("stroke","#ccc").attr("stroke-width",0.5).attr("d",path); svg.append("path").datum(topojson.feature(world,world.objects.land)).attr("fill","#ddd").attr("d",path); svg.append("path").datum(topojson.mesh(world,world.objects.countries,(a,b)=>a!==b)).attr("fill","none").attr("stroke","#999").attr("stroke-width",0.5).attr("d",path);
//   const sorted=footprints.sort((a,b)=>b.gain-a.gain); svg.selectAll(".footprint").data(sorted).enter().append("path").attr("class","footprint").attr("d",d=>{if(d.points.length<2)return null;const c=d.points.map(([lat,lon])=>[lon,lat]);c.push(c[0]);return path({type:"Polygon",coordinates:[c]})}).attr("fill","none").attr("stroke",d=>colors[d.index-1]||"black").attr("stroke-width",2);
//   const [sx,sy]=proj([controls.satelliteLon,controls.satelliteLat]),[tx,ty]=proj([controls.antennaLon,controls.antennaLat]); svg.append("line").attr("x1",sx).attr("y1",sy).attr("x2",tx).attr("y2",ty).attr("class","connector-line").attr("stroke","red").attr("stroke-width",1).attr("stroke-dasharray","4,4"); svg.append("circle").attr("class","marker").attr("cx",sx).attr("cy",sy).attr("r",5).attr("fill","red").attr("stroke","#fff"); svg.append("circle").attr("class","marker").attr("cx",tx).attr("cy",ty).attr("r",4).attr("fill","lime").attr("stroke","#fff");
//   const satE=geodeticToECEF(controls.satelliteLat,controls.satelliteLon,controls.satelliteAlt),tarE=geodeticToECEF(controls.antennaLat,controls.antennaLon,0),bore=normalize(tarE.map((v,i)=>v-satE[i]));
  
//   // Define axes for the tooltip calculation if elliptical
//   const arbitraryVec = Math.abs(bore[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
//   const axis1 = normalize(cross(bore, arbitraryVec));
//   const axis2 = normalize(cross(bore, axis1));
  
//   svg.on("mousemove",function(e){
//     const [mx,my]=d3.pointer(e),[lon,lat]=proj.invert([mx,my]);if(isNaN(lat)||isNaN(lon)){tip.style("display","none");return}
//     const pE=geodeticToECEF(lat,lon,0),vP=normalize(pE.map((v,i)=>v-satE[i]));
    
//     let gain;
//     if (controls.gainPatternType.startsWith("Elliptical")) {
//         const dotB = dot(vP, bore);
//         const theta_rad = Math.atan2(dot(vP, axis1), dotB);
//         const phi_rad = Math.atan2(dot(vP, axis2), dotB);
//         gain = gainPatternElliptical(theta_rad * 180 / Math.PI, phi_rad * 180 / Math.PI, controls.Gm, controls.theta3dB, controls.phi3dB);
//     } else {
//         const dotP=Math.max(-1,Math.min(1,dot(bore,vP))),psiR=Math.acos(dotP),psiD=psiR*180/Math.PI;
//         gain=getGainAtAngle(psiD,controls);
//     }
//     tip.style("display","block").style("left",mx+15+"px").style("top",my+"px").html(`<strong>Lat:</strong> ${lat.toFixed(2)}°<br><strong>Lon:</strong> ${lon.toFixed(2)}°<br><strong>Gain:</strong> ${gain.toFixed(2)} dBi`);
//   }).on("mouseleave",()=>tip.style("display","none"));
  
//   const leg=svg.append("g").attr("transform","translate(10,10)"); leg.append("rect").attr("width",240).attr("height",100).attr("fill","rgba(255,255,255,0.8)").attr("stroke","#ccc"); leg.append("text").attr("x",5).attr("y",15).text("Gain Contours").attr("font-weight","bold").attr("font-size","12px");
//   footprints.forEach((fp,i)=>{if(fp.points.length===0)return;const y=30+i*18,areaFmt=fp.area_km2.toLocaleString('en-US',{maximumFractionDigits:0}); leg.append("rect").attr("x",5).attr("y",y-8).attr("width",10).attr("height",10).attr("fill",colors[fp.index-1]); leg.append("text").attr("x",20).attr("y",y).text(`Gain ${fp.index}: ${fp.gain.toFixed(1)} dBi (${areaFmt} km²)`).attr("font-size","11px")});
//   return cont.node();
// }


function destinationLatLon(lat, lon, az, psi) {
  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;
  const θ = az * Math.PI / 180;
  const δ = psi * Math.PI / 180;
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * sinφ2);
  return [λ2 * 180 / Math.PI, φ2 * 180 / Math.PI];
}
let currentProjection = "orthographic"; // Default projection
let rotation = [0, 0, 0]; // 

function getProjectionConfig() {
    const config = { type: currentProjection };
    
    // Add rotation for 3D projections
    if (currentProjection === "orthographic" || 
        currentProjection === "azimuthal-equal-area" || 
        currentProjection === "stereographic") {
      config.rotate = rotation;
    }
    
    // Special configurations for specific projections
    if (currentProjection === "albers-usa") {
      config.parallels = [29.5, 45.5];
    }
    
    return config;
  }

  function validateContourNesting(footprints) {
  // Sort footprints by gain (highest to lowest)
  const sortedFootprints = [...footprints].sort((a, b) => b.gain - a.gain);
  
  for (let i = 0; i < sortedFootprints.length - 1; i++) {
    const higherGainContour = sortedFootprints[i];
    const lowerGainContour = sortedFootprints[i + 1];
    
    // If higher gain contour has larger area than lower gain, there's likely a crossing
    if (higherGainContour.area_km2 > lowerGainContour.area_km2 * 1.1) { // 10% tolerance
      // Invalidate the problematic lower gain contour
      lowerGainContour.points = [];
      lowerGainContour.area_km2 = 0;
    }
  }
  
  return sortedFootprints;
}


function multiGainMap({ world, footprints, controls }) {
  const width = 800, height = 500;
  const colors = ["#00ff00", "#ffff00", "#ffa500", "#ff0000"];
  const projections = [
    { value: "mercator", label: "Mercator" },
    { value: "orthographic", label: "Orthographic (3D Globe)" },
    { value: "azimuthalEqualArea", label: "Azimuthal Equal Area" },
    { value: "stereographic", label: "Stereographic" },
    { value: "equirectangular", label: "Equirectangular" }
  ];

  let currentProjection = "orthographic";
  let rotation = [0, 0, 0];
  let isDragging = false;
  let lastMousePos = null;

  // Container
  const container = document.createElement("div");
  container.style.position = "relative";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;

  // Projection selector
  const selector = document.createElement("select");
  selector.style.position = "absolute";
  selector.style.top = "10px";
  selector.style.right = "10px";
  selector.style.zIndex = "1000";
  selector.style.padding = "5px";
  selector.style.background = "white";
  selector.style.border = "1px solid #ccc";
  selector.style.borderRadius = "4px";
  selector.style.fontSize = "12px";
  projections.forEach(proj => {
    const opt = document.createElement("option");
    opt.value = proj.value;
    opt.textContent = proj.label;
    if (proj.value === currentProjection) opt.selected = true;
    selector.appendChild(opt);
  });
  selector.addEventListener("change", e => {
    currentProjection = e.target.value;
    if (currentProjection !== "orthographic") rotation = [0, 0, 0];
    draw();
  });

  function getProjection() {
    let proj;
    switch (currentProjection) {
      case "mercator": proj = d3.geoMercator(); break;
      case "orthographic":
        proj = d3.geoOrthographic().rotate(rotation);
        break;
      case "azimuthalEqualArea": proj = d3.geoAzimuthalEqualArea().rotate(rotation); break;
      case "stereographic": proj = d3.geoStereographic().rotate(rotation); break;
      case "equirectangular": proj = d3.geoEquirectangular(); break;
      default: proj = d3.geoOrthographic().rotate(rotation);
    }
    proj.fitSize([width, height], topojson.feature(world, world.objects.land));
    return proj;
  }

  function handleMouseDown(e) {
    if (currentProjection === "orthographic") {
      isDragging = true;
      lastMousePos = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }
  function handleMouseMove(e) {
    if (isDragging && currentProjection === "orthographic" && lastMousePos) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      const sensitivity = 0.5;
      rotation[0] -= deltaX * sensitivity;
      rotation[1] += deltaY * sensitivity;
      rotation[1] = Math.max(-90, Math.min(90, rotation[1]));
      lastMousePos = { x: e.clientX, y: e.clientY };
      draw();
    }
  }
  function handleMouseUp() {
    isDragging = false;
    lastMousePos = null;
  }

  function draw() {
    container.innerHTML = "";
    const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block")
      .style("background", "#e6f3ff")
      .node();

    // World map
    const projection = getProjection();
    const path = d3.geoPath(projection);

    const worldGeoJSON = topojson.feature(world, world.objects.land);
    d3.select(svg)
      .append("path")
      .datum(worldGeoJSON)
      .attr("d", path)
      .attr("fill", "#e6f3ff")
      .attr("stroke", "#999");

    // Graticule
    const graticule = d3.geoGraticule();
    d3.select(svg)
      .append("path")
      .datum(graticule())
      .attr("d", path)
      .attr("stroke", "#ccc")
      .attr("fill", "none");

    // Gain contours
    const sortedFootprints = [...footprints].sort((a, b) => b.gain - a.gain);
    sortedFootprints.forEach((fp, i) => {
      if (!fp.points || fp.points.length < 3) return;
      const coords = fp.points.map(([lat, lon]) => [lon, lat]);
      coords.push(coords[0]);
      const poly = turf.polygon([coords]);
      d3.select(svg)
        .append("path")
        .datum(poly)
        .attr("d", path)
        .attr("stroke", colors[i])
        .attr("stroke-width", 2)
        .attr("fill", "none");
    });

    // Satellite and beam points
    const sat = projection([controls.satelliteLon, controls.satelliteLat]);
    const beam = projection([controls.antennaLon, controls.antennaLat]);
    d3.select(svg)
      .append("circle")
      .attr("cx", sat[0])
      .attr("cy", sat[1])
      .attr("r", 4)
      .attr("fill", "red")
      .attr("stroke", "white");
    d3.select(svg)
      .append("circle")
      .attr("cx", beam[0])
      .attr("cy", beam[1])
      .attr("r", 4)
      .attr("fill", "lime")
      .attr("stroke", "white");

    // Line between satellite and beam
    d3.select(svg)
      .append("line")
      .attr("x1", sat[0])
      .attr("y1", sat[1])
      .attr("x2", beam[0])
      .attr("y2", beam[1])
      .attr("stroke", "red")
      .attr("stroke-dasharray", "4,4")
      .attr("stroke-width", 1);

    svg.addEventListener("mousedown", handleMouseDown);
    svg.addEventListener("mousemove", handleMouseMove);
    svg.addEventListener("mouseup", handleMouseUp);
    svg.addEventListener("mouseleave", handleMouseUp);

    svg.style.cursor = currentProjection === "orthographic"
      ? (isDragging ? "grabbing" : "grab")
      : "default";

    container.appendChild(svg);
    container.appendChild(selector);

    // Legend
    const legend = document.createElement("div");
    legend.style.position = "absolute";
    legend.style.top = "10px";
    legend.style.left = "10px";
    legend.style.background = "rgba(255,255,255,0.8)";
    legend.style.padding = "5px";
    legend.style.border = "1px solid #ccc";
    legend.style.fontSize = "12px";
    legend.style.borderRadius = "4px";
    legend.innerHTML = `<div style="font-weight: bold; margin-bottom: 5px;">Gain Contours</div>` +
      sortedFootprints.map((fp, i) =>
        fp.points.length > 0 ? `
          <div style="display: flex; align-items: center; margin: 2px 0;">
            <div style="width: 12px; height: 12px; background: ${colors[i]}; margin-right: 5px; border: 1px solid #777;"></div>
            <span>
              <b>Contour ${fp.index}:</b> ${fp.relativeGain.toFixed(1)} dB (abs: ${fp.gain.toFixed(1)} dBi)<br>
              <span style="font-size:11px;">Area: ${fp.area_km2.toLocaleString('en-US', {maximumFractionDigits: 0})} km²</span>
            </span>
          </div>
        ` : ""
      ).join("");
    container.appendChild(legend);

    // Instructions
    if (currentProjection === "orthographic") {
      const instructions = document.createElement("div");
      instructions.style.position = "absolute";
      instructions.style.bottom = "10px";
      instructions.style.right = "10px";
      instructions.style.background = "rgba(255,255,255,0.9)";
      instructions.style.padding = "5px";
      instructions.style.border = "1px solid #ccc";
      instructions.style.fontSize = "11px";
      instructions.style.borderRadius = "4px";
      instructions.style.maxWidth = "150px";
      instructions.innerHTML = `<div style="font-weight: bold; margin-bottom: 2px;">Globe Controls:</div>
        <div>Click and drag to rotate</div>`;
      container.appendChild(instructions);
    }
  }

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  draw();
  return container;
}

export {geodeticToECEF,
  ecefToGeodetic,
  normalize,
  dot,
  cross,
  rotateVector,
  gainPatternGSO,
  gainPatternMEO,
  gainPatternLEO,
  gainPatternSingleFeed,
  gainPatternElliptical,
  getGainAtAngle,
  computeFootprintElliptical,
  computeFootprint,
  calculateFootprintArea,
  destinationLatLon,
  getProjectionConfig,
  validateContourNesting,
  multiGainMap

  };