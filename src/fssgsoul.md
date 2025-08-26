---
title: FSS GSO UL Controls
theme: air
# theme: [slate,alt]
---


```js
import {Banner} from "/components/utils.js"
import {calculateLookAngles} from "./components/utils.js"

```

<div id="parent">
 ${Banner("GSO Antenna Contour")}
</div>


```js
import * as d3 from "npm:d3";
import * as topojson from "topojson-client";
import * as turf from "@turf/turf";
```

```js
import {
  // geodeticToECEF,
  // ecefToGeodetic,
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
  getFootprints,
  // calculateLookAngles
  // multiGainSVG,
} from "./components/s672.js";
```

```js
// var fssGsoEsParams = await FileAttachment("specs/fssgso/es.json").json();
var fssGsoSsParams = await FileAttachment("specs/fssgso/ss.json").json();
```

```js
// var selectGsoEs = Inputs.select(fssGsoEsParams, {
//   label: "Earth Station ",
//   format: (v) => v.Type,
// });
// const gsoEs = Generators.input(selectGsoEs);

var gsoSs = view( Inputs.select(fssGsoSsParams, {
  label: "Space Station",
  format: (v) => v.ssType,
}));
// const gsoSs = Generators.input(selectGsoSs);
```

<h2>FSS GSO Parameters</h2>
<div class="grid grid-cols-2">
<div class="card">

 <!-- ${gsoSs} -->

```js
display({ gsoSs });
```

</div>

</div>
 


## Input Parameters

 
```js
const gainPatternType = view(
  Inputs.select(
    [
      "GSO Reference Pattern",
      "MEO Reference Pattern",
      "LEO Reference Pattern",
      "Single Feed (ITU-R S.672-1)",
      "Elliptical Beam",
    ],
    { label: "Antenna Pattern Model", value: "GSO Reference Pattern",disabled:true }
  )
);
```

<div class="floatingbox sidenote" data-pinned="true" style="max-width:100%"> 
<a class="ui right teal corner label " id="pinme" onclick="toggleWindow('.floatingbox')">
<i class="icon pin"></i>
</a>

<div style="display:block" >

```js
const satelliteLat = view(
  Inputs.range([-90, 90], {
    label: "Sat Lat (°)",
    step: 0.1,
    value: 0,
  })
);

const satelliteLon = view(
  Inputs.range([-180, 180], {
    label: "Sat Lon (°)",
    step: 0.1,
    value: 0,
  })
);

const satelliteAlt = view(
  Inputs.range([300, 36000], {
    label: "Sat Alt (km)",
    step: 10,
    disabled:true,
    value: 35786,
  })
);

const antennaLat = view(
  Inputs.range([-90, 90], {
    label: "Beam Lat (°)",
    step: 0.1,
    value: 0,
  })
);

const antennaLon = view(
  Inputs.range([-180, 180], {
    label: "Beam Lon (°)",
    step: 0.1,
    value: 0,
  })
);
```
</div>

</div>

<div style="display:block" >

  <div class="grid grid-cols-2"  style="grid-auto-rows: auto;">

  <div class="card">

<!-- #### Controls for Elliptical Pattern


```js
const Gm_Elliptical = view(Inputs.range([0, 60], {label: "G₀ (dBi)", step: 0.1, value: 45}));
const theta3dB_Elliptical = view(Inputs.range([0.1, 10], {label: "θ₃ₐₒ (°)", step: 0.05, value: 2.5}));
const phi3dB_Elliptical = view(Inputs.range([0.1, 10], {label: "φ₃ₐₒ (°)", step: 0.05, value: 1.5})); -->

```js
const selectedSS = gsoSs;
const Gm_GSO = view(
  Inputs.range([0, 60], {
    label: "Gₘ (dBi)",
    step: 0.1,
    value: selectedSS?.AntennaPeakGainTx ?? 35,
  })
);
```


```js
const psi0_GSO = view(
  Inputs.range([0.1, 10], {
    label: "φ₃ₑdB (°)",
    step: 0.01,
    value: selectedSS?.AntennaPatternRx.BW3db ?? 2.5,
  })
);
const Ls_GSO = view(
  Inputs.select([-10, -20], {
    label: "Lₛ (dB)",
    value: selectedSS?.AntennaPatternRx.Ls ?? -10,
  })
);
```

</div>

  <div class="card">

#### Target Gain Controls

```js
const gain_rel_1 = view(
  Inputs.range([-30, 0], {
    label: "Contour (dB rel. to Gₘ)",
    step: 1,
    value: -3,
  })
);
// const gain_rel_2 = view(Inputs.range([-30, 0], {label: "Contour 2 (dB rel. to Gₘ)", step: 0.1, value: -6}));
// const gain_rel_3 = view(Inputs.range([-30, 0], {label: "Contour 3 (dB rel. to Gₘ)", step: 0.1, value: -10}));
// const gain_rel_4 = view(Inputs.range([-30, 0], {label: "Contour 4 (dB rel. to Gₘ)", step: 0.1, value: -20}));
```

</div>

</div>

```js
const rotate = view(
  Inputs.range([-180, 180], { label: "Rotate", value: satelliteLon,step:1 })
);
```

```js
const rotateZ = view(Inputs.range([-180, 180], { label: "Rotate Z",step:1 }));

```

```js
const projectionType = view(Inputs.select(["mercator","orthographic","equal-earth"], { label: "Projection Type" }));
```

```js
const p=Plot.plot({
  width:500,
  style:{currentcolor:"var(--theme-foreground-focus)"},
  // height:500,
  aspectRatio:1.5,
  title: "Location : ",
  // width,
  // height: 200,
  // aspectRatio: 0.3,
  color: {
    legend: false,
    // type: "linear",
    // reverse: true,
    // scheme: "Magma",
    // domain: [0, 90],
  },
  r: { legend: true },
  legend: true,
   
  projection: { type: projectionType, rotate: [-rotate, -rotateZ] },
  marks: [
    Plot.sphere(),
    Plot.graticule(),
    // Plot.geo(land, { fill: "lightblue" }),
    // Plot.geo(world),
    Plot.geo(world, { stroke: "grey", strokeOpacity: 0.2, fillOpacity:.5, fill:d=> 
       d.properties.UNRegion==null?null:d.properties.UNRegion }),
    Plot.geo(india, { stroke: "grey", fill: "black", fillOpacity: 0.05 }),
    Plot.geo(contour, { stroke: "red", fill: "grey", fillOpacity: 0.1,strokeOpacity: 1,strokeDasharray:[5,5]}),
    Plot.geo(squaregrid, { stroke: "white",  fillOpacity: 0.1,r:1}),
    Plot.text(["📡"],{x:controls.antennaLon,y:controls.antennaLat,fontSize:10}),
    Plot.text(["🛰"],{x:controls.satelliteLon,y:controls.satelliteLat,fontSize:25}),
    
    
  ],
});

display(p)
```

<!-- <div style="display:block" >

  <div class="grid grid-cols-3"  style="grid-auto-rows: auto;">

  <div class="card"> -->

<!-- </div>

  <div class="card">

#### MEO Control
```js
const Gm_MEO = view(Inputs.range([0,60],{label:"Gₘ (dBi)",step:0.1,value:35}));
const Ls_MEO = view(Inputs.range([-30,0],{label:"Lₛ (dB)",step:0.1,value:-12}));
const psi_b_MEO = view(Inputs.range([0.1,10],{label:"ψᵦ (°)",step:0.01,value:1.6}));
const psi_z_MEO = view(Inputs.range([10,45],{label:"Z Angle (°)",step:0.1,value:20.0}));
const gainFloor_MEO = view(Inputs.range([-10,20],{label:"Gain Floor (dBi)",step:0.1,value:3}));
```
 </div>

  <div class="card">

#### LEO Control

```js
const Gm_LEO = view(Inputs.range([0,60],{label:"Gₘ (dBi)",step:0.1,value:35}));
const Ls_LEO = view(Inputs.range([-30,0],{label:"Lₛ (dB)",step:0.1,value:-6.75}));
const psi_b_LEO = view(Inputs.range([0.1,10],{label:"ψᵦ (°)",step:0.01,value:1.6}));
const psi_z_LEO = view(Inputs.range([10,45],{label:"Z Angle (°)",step:0.1,value:20.4}));
const gainFloor_LEO = view(Inputs.range([-10,20],{label:"Gain Floor (dBi)",step:0.1,value:5}));
``` -->
</div>

</div>

<!-- #### SF Control

```js
const Gm_SF = view(Inputs.range([0,60],{label:"Gₘ (dBi)",step:0.1,value:40}));
const Ls_SF = view(Inputs.select([-20,-25,-30],{label:"Lₛ (dB)",value:-25}));
const psi0_SF = view(Inputs.range([0.1,10],{label:"ψ₀ (°)",step:0.01,value:1.5}));
``` -->

</div>

</div>


```js
const controls = {
  gainPatternType,
  satelliteLat,
  satelliteLon,
  satelliteAlt,
  gain_rel_1,
  antennaLat,
  antennaLon,
  Gm: Gm_GSO,
  psi0: psi0_GSO,
  Ls: Ls_GSO,
};
```
 

```js
const tmp = getFootprints(controls);

const contour=turf.polygon([tmp[0].points])
const bbox=turf.bbox(contour)
const squaregrid=turf.pointGrid(bbox,500,{unit:"kilometer",mask:contour})
// display({ contour,squaregrid });
```

```js
// Add a button to download the JSON object countour
```

Total Area under the footprint is ${(AreasqKm/1e6).toFixed(2)}M sqkm

```js
const AreasqKm=(turf.area(contour)/1e6) /// sqm to sqkm

```


```js 
// import { multiGainMap } from './components/s672.js';
import * as d3 from "d3";
```

```js  
// % const map = multiGainMap({ world, footprints, controls });
// % display(map);
```


```js
var world = await FileAttachment("./data/mergedworlds.topojson.json").json();
// display({ world });
```

```js 
// import { world, land }  from "@d3/world-map"
const india = fetch(
  "https://raw.githubusercontent.com/datameet/maps/refs/heads/master/Country/india-osm.geojson"
).then((response) => response.json());
```

```js

function toggleWindow(selector) {
  const p = document.querySelector(selector);
    const isPinned = p.getAttribute('data-pinned') === 'true';
  p.setAttribute('data-pinned', !isPinned ? 'true' : 'false');

//  if(isPinned){
//   }
p.classList.toggle("ui");
 p.classList.toggle("segment");
//  p.classList.toggle("floatingbox");
 p.classList.toggle("sidenote");

  // console.log(window);
}

```

Azimuth: ${angles.azimuth.toFixed(2)}°;
Elevation: ${angles.elevation.toFixed(2)}°

```js
// === Example Usage ===

// Example: Observer in London, UK, looking at a satellite over a specific point
const observerLat = antennaLat; // London, UK
const observerLng = antennaLon;
// const satelliteLat = 0; // Satellite over the Equator
// const satelliteLng = 0; // Satellite over the Greenwich Meridian
// const satelliteLat = 0; // Satellite over the Equator
const satelliteLng=satelliteLon
const satelliteAltitude = 35786; // Geostationary orbit altitude in km

const angles = calculateLookAngles(
  observerLat,
  observerLng,
  satelliteLat,
  satelliteLng,
  satelliteAltitude
);


// A more realistic example with a specific satellite
// Observer: London (51.5074° N, -0.1278° W)
// Satellite: Intelsat 907 (70° E) at GEO altitude (~35786 km)
// const realAngles = calculateSatelliteAngles(51.5074, -0.1278, 0, 70, 35786);
//display("\n--- Example for a Geostationary Satellite ---");
//display(`Azimuth: ${realAngles.azimuth.toFixed(2)}°`);
// display(`Elevation: ${realAngles.elevation.toFixed(2)}°`);


```