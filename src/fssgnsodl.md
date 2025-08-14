---
title: FSS NGSO DL Controls
theme: cotton
---

This notebook provides an interactive visualization of satellite antenna gain footprints on the Earth's surface. It allows users to select from several standard ITU-R (International Telecommunication Union Radiocommunication Sector) antenna pattern models, configure satellite and beam parameters, and observe the resulting gain contours on a world map.

The primary purpose of this tool is to understand how various parameters—such as satellite altitude, beamwidth, and antenna gain—affect the coverage area and gain distribution of a satellite's signal on the ground.

```js
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import * as turf from '@turf/turf';
```

```js
import {
  geodeticToECEF,
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
  } from './components/s672.js';
```


-------




```js 
var fssNgsoEsParams = await FileAttachment("specs/fssngso/es.json").json();
//var fssNgsoSsParams = await FileAttachment("specs/fssngso/ss.json").json();
```

```js
var selectNgsoEs = Inputs.select(fssNgsoEsParams, {
  label: "NGSO Earth Station Type",
  format: (v) => v.Type,
});
const ngsoEs = Generators.input(selectNgsoEs);

// var selectNgsoSs = Inputs.select(fssNgsoSsParams, {
//   label: "NGSO Space Station Type",
//   format: (v) => v.Type,
// });
// const ngsoSs = Generators.input(selectNgsoSs);
```


<h2>FSS NGSO Parameters</h2>
<div class="grid grid-cols-2">
<div class="card">

${selectNgsoEs}

</div>
<div class="card">

```js
display({ ngsoEs });
```


</div>

</div>
 
  


```js 
var world = await FileAttachment(
  "./components/world.json"
).json();
display({world});
```

## Input Parameters

```js
const gainPatternType = view(Inputs.select(
    [
      "GSO Reference Pattern", 
      "MEO Reference Pattern", 
      "LEO Reference Pattern", 
      "Single Feed (ITU-R S.672-1)",
      "Elliptical Beam"
    ], 
    {label: "Antenna Pattern Model", value: "GSO Reference Pattern"}
  ));

 const satelliteLat = view(Inputs.range([-90, 90], {
    label: "Sat Lat (°)",
    step: 0.1,
    value: 0,
  }));

const satelliteLon = view(Inputs.range([-180, 180], {
    label: "Sat Lon (°)",
    step: 0.1,
    value: 0,
  }));

 const satelliteAlt = view(Inputs.range([300, 36000], {
    label: "Sat Alt (km)",
    step: 10,
    value: 36000,
  }));


const antennaLat = view(Inputs.range([-90, 90], {
    label: "Beam Lat (°)",
    step: 0.1,
    value: 0,
  }));

 const antennaLon = view(Inputs.range([-180, 180], {
    label: "Beam Lon (°)",
    step: 0.1,
    value: 0,
  }));
```

### Controls for each pattern


<div style="display:block" >

  <div class="grid grid-cols-3"  style="grid-auto-rows: auto;">

  <div class="card">


#### GSO Control

```js
const Gm_GSO = view(Inputs.range([0,60],{label:"Gₘ (dBi)",step:0.1,value:40}));
const Ls_GSO = view(Inputs.select([-10,-20],{label:"Lₛ (dB)",value:-10}));
const psi0_GSO = view(Inputs.range([0.1,10],{label:"ψ₀ (°)",step:0.01,value:1.5}));
```
</div>

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
```
</div>

</div>


#### SF Control

```js 
const Gm_SF = view(Inputs.range([0,60],{label:"Gₘ (dBi)",step:0.1,value:40}));
const Ls_SF = view(Inputs.select([-20,-25,-30],{label:"Lₛ (dB)",value:-25}));
const psi0_SF = view(Inputs.range([0.1,10],{label:"ψ₀ (°)",step:0.01,value:1.5}));
```
</div>

</div>

<div style="display:block" >

  <div class="grid grid-cols-2"  style="grid-auto-rows: auto;">

  <div class="card">

#### Controls for Elliptical Pattern

 
```js
const Gm_Elliptical = view(Inputs.range([0, 60], {label: "G₀ (dBi)", step: 0.1, value: 45}));
const theta3dB_Elliptical = view(Inputs.range([0.1, 10], {label: "θ₃ₐₒ (°)", step: 0.05, value: 2.5}));
const phi3dB_Elliptical = view(Inputs.range([0.1, 10], {label: "φ₃ₐₒ (°)", step: 0.05, value: 1.5}));
```
</div>

  <div class="card">

#### Target Gain Controls

```js
const gain_rel_1 = view(Inputs.range([-30, 0], {label: "Contour 1 (dB rel. to Gₘ)", step: 0.1, value: -3}));
const gain_rel_2 = view(Inputs.range([-30, 0], {label: "Contour 2 (dB rel. to Gₘ)", step: 0.1, value: -6}));
const gain_rel_3 = view(Inputs.range([-30, 0], {label: "Contour 3 (dB rel. to Gₘ)", step: 0.1, value: -10}));
const gain_rel_4 = view(Inputs.range([-30, 0], {label: "Contour 4 (dB rel. to Gₘ)", step: 0.1, value: -20}));
```

```js
const Gm = Gm_GSO;
```

</div>

</div>

```js 

const controls =({gainPatternType,satelliteLat,satelliteLon,satelliteAlt,gain_rel_1, gain_rel_2, gain_rel_3, gain_rel_4 ,satelliteLat, satelliteLon, satelliteAlt,antennaLat, antennaLon,Gm});

display({controls});

```


```js 
const relativeGains = [
    controls.gain_rel_1,
    controls.gain_rel_2,
    controls.gain_rel_3,
    controls.gain_rel_4
  ];
display({relativeGains});

 // Calculate absolute gains by adding the (negative) relative gain to Gm
const absoluteGains = relativeGains.map(rel_gain => controls.Gm + rel_gain);
display({absoluteGains});

const satECEF = geodeticToECEF(controls.satelliteLat, controls.satelliteLon, controls.satelliteAlt);
display({satECEF});

const targetECEF = geodeticToECEF(controls.antennaLat, controls.antennaLon, 0);
display({targetECEF});

const boresight = normalize(targetECEF.map((v, i) => v - satECEF[i]));
display({boresight});

const isElliptical = controls.gainPatternType.startsWith("Elliptical");
display({isElliptical});
```

```js
// Calculate footprints for each gain level
function getFootprints() {
  return absoluteGains.map((gain, index) => {
    const points = isElliptical
      ? computeFootprintElliptical(satECEF, boresight, controls, gain)
      : computeFootprint(satECEF, boresight, controls, gain);

    const area_km2 = calculateFootprintArea(points);
    return {
      gain: gain, // Absolute gain (e.g., 37 dBi)
      relativeGain: relativeGains[index], // Relative gain from slider (e.g., -3 dB)
      index: index + 1,
      points: points,
      area_km2: area_km2
    };
  });
}
```

```js
const footprints = getFootprints();
display({footprints});
```

