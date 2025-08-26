---
title: ss
---

```js
import {Banner} from "/components/utils.js"
```

<div id="parent">
 
 ${Banner("Articles")}
</div>

# ITU-R S.672: Satellite Antenna Models

This notebook provides an interactive visualization of satellite antenna gain footprints on the Earth's surface. It allows users to select from several standard ITU-R (International Telecommunication Union Radiocommunication Sector) antenna pattern models, configure satellite and beam parameters, and observe the resulting gain contours on a world map.


The primary purpose of this tool is to understand how various parameters—such as satellite altitude, beamwidth, and antenna gain—affect the coverage area and gain distribution of a satellite's signal on the ground.
 

<div class="grid grid-cols-2">
<div class="card">

[FSS GSO Earth-to-Space (UL)](fssgsoul)

GSO Satellites with Space Stations antenna pattern ITU-R S.672 {.note label="ITU-R S.672}

</div>


<div class="card red">

[FSS non-GSO Earth-to-Space (UL)](fssngsoul)

Non GSO Satellites with Space Stations antenna pattern S.1528 {.note label="ITU-R S.1528}

</div>



<div class="card">

[non-GSO Orbital patterns](ngso-orbits)

Non GSO Satellites with Space Stations antenna pattern S.1528 {.note label="ITU-R S.1528}

</div>


</div>






