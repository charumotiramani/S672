---
title: FSS GSO DL Controls
theme: cotton
---


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
  getProjectionConfig,
  validateContourNesting,
  multiGainSVG 
  } from './components/s672.js';
```

```js

var fssGsoEsParams = await FileAttachment("specs/fssgso/es.json").json();
//var fssGsoSsParams = await FileAttachment("specs/fssgso/ss.json").json();
```


```js
var selectGsoEs = Inputs.select(fssGsoEsParams, {
  label: "Earth Station ",
  format: (v) => v.esType,
});
const gsoEs = Generators.input(selectGsoEs);
```


<h2>FSS GSO Parameters</h2>
<div class="grid grid-cols-2">
<div class="card">

 ${selectGsoEs}

```js
display(gsoEs);
```

</div>

</div>
 
 


```js 
var world = await FileAttachment(
  "./components/world.json"
).json();
//display({world});
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




#### GSO Control


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
```
</div>

</div> -->

<div style="display:block" >

  <div class="grid grid-cols-2"  style="grid-auto-rows: auto;">

  <div class="card">

<!-- #### Controls for Elliptical Pattern

 
```js
const Gm_Elliptical = view(Inputs.range([0, 60], {label: "G₀ (dBi)", step: 0.1, value: 45}));
const theta3dB_Elliptical = view(Inputs.range([0.1, 10], {label: "θ₃ₐₒ (°)", step: 0.05, value: 2.5}));
const phi3dB_Elliptical = view(Inputs.range([0.1, 10], {label: "φ₃ₐₒ (°)", step: 0.05, value: 1.5}));
``` -->

```js
// const Gm_GSO = view(Inputs.range([0,60],{label:"Gₘ (dBi)",step:0.1,value:40}));
// const Ls_GSO = view(Inputs.select([-10,-20],{label:"Lₛ (dB)",value:-10}));
// const psi0_GSO = view(Inputs.range([0.1,10],{label:"ψ₀ (°)",step:0.01,value:1.5}));
const selected = gsoEs;
const Gm_GSO = view(Inputs.range([0, 60], { label: "Gₘ (dBi)", step: 0.1, value: selected?.AntennaPeakGainRx ?? 40 }));
const psi0_GSO= view(Inputs.range([0.1, 10], { label: "φ₃ₑdB (°)", step: 0.01, value: selected?.Antenna3dbRx ?? 1.5 }));
const Ls_GSO = view(Inputs.select([-10,-20],{label:"Lₛ (dB)",value:-10}));

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


</div>

</div>



```js 
const controls = {
  gainPatternType, satelliteLat, satelliteLon, satelliteAlt,
  gain_rel_1, gain_rel_2, gain_rel_3, gain_rel_4,
  antennaLat, antennaLon,
  Gm: Gm_GSO,
  psi0: psi0_GSO,
  Ls: Ls_GSO
};
//display({controls});
```


```js 
function getFootprints() {
  const relativeGains = [
    controls.gain_rel_1,
    controls.gain_rel_2,
    controls.gain_rel_3,
    controls.gain_rel_4
  ];
  

  const absoluteGains = relativeGains.map(rel_gain => controls.Gm + rel_gain);
  const satECEF = geodeticToECEF(controls.satelliteLat, controls.satelliteLon, controls.satelliteAlt);
  const targetECEF = geodeticToECEF(controls.antennaLat, controls.antennaLon, 0);
  const boresight = normalize(targetECEF.map((v, i) => v - satECEF[i]));
  const isElliptical = controls.gainPatternType.startsWith("Elliptical");

  let rawFootprints = absoluteGains.map((gain, index) => {
    const points = isElliptical
      ? computeFootprintElliptical(satECEF, boresight, controls, gain)
      : computeFootprint(satECEF, boresight, controls, gain);

    const area_km2 = calculateFootprintArea(points);
    return {
      gain: gain,
      relativeGain: relativeGains[index],
      index: index + 1,
      points: points,
      area_km2: area_km2
    };
  });
  
  // NEW: Validate and fix contour nesting issues
  return validateContourNesting(rawFootprints);
}
```



```js
const footprints = getFootprints();
//display({footprints});
```


```js
import { multiGainMap } from './components/s672.js';
import * as d3 from 'd3';
```


```js echo 
const map = multiGainMap({ world, footprints, controls });
display(map);
```