import fetch from 'node-fetch';
import * as topojson from 'topojson-client';
import * as topojsonSimplify from 'topojson-simplify';
import fs from'fs';

// const weight = 0.0002;
const weight = 0.0001;
async function getWorldTopojson(){
    let topology = await fetch('https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM1.topojson');
    topology = await topology.json();
    const preSimplified = topojsonSimplify.presimplify(topology);
    const simplified = topojsonSimplify.simplify(preSimplified, weight);
    const quantized = topojson.quantize(simplified, 1e6);
    fs.writeFileSync(`../../../map-builder/assets/world_adm1_simplified.topojson`, JSON.stringify(quantized));
    return true
}

getWorldTopojson().then(res => {
    console.log('done');    
});