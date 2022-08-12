import fetch from 'node-fetch';
import fs from'fs';
import mapshaper from 'mapshaper';

const assetsPath = 'map-builder/src/assets/layers';
async function getWorldTopojson(){
    let topology = await fetch('https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM1.topojson');
    topology = await topology.json();
    console.log('Topology downloaded');
    let simplified =  await mapshaper.applyCommands('-i topo.topojson -simplify 2% -clean -o output.geojson', {'topo.topojson': topology});
    console.log('Simplification done');
    simplified = JSON.parse(Buffer.from(simplified['output.geojson']).toString('utf-8'));

    let adm0 = await mapshaper.applyCommands('-i simp.geojson -dissolve shapeGroup -clean -o quantization=100000000000 output.topojson', {'simp.geojson': simplified});
    adm0 = JSON.parse(Buffer.from(adm0['output.topojson']).toString('utf-8'));
    fs.writeFileSync(`${assetsPath}/world_adm0_simplified.topojson`, JSON.stringify(adm0));
    
    let landExtremelySimplified = await mapshaper.applyCommands('-i adm0.geojson -simplify 10% -dissolve -clean -o quantization=100000000000 output.topojson', {'adm0.geojson': adm0});
    landExtremelySimplified = JSON.parse(Buffer.from(landExtremelySimplified['output.topojson']).toString('utf-8'));
    fs.writeFileSync(`${assetsPath}/world_land_very_simplified.topojson`, JSON.stringify(landExtremelySimplified));
    
    const byCountry = {};
    let nbUnknown = 1;
    simplified.features.forEach((feat) => {
        const group = feat.properties?.shapeGroup;
        if (group) {
            if (!(group in byCountry)) byCountry[group] = [feat];
            else byCountry[group].push(feat);
        }
        else byCountry[`Unknown ${nbUnknown++}`] = [feat];
    });
    Object.entries(byCountry).forEach(async ([country, features], i) => {
        const fileName = `${country}_ADM1.topojson`;
        let geojson = {type: 'FeatureCollection', features: features};
        geojson = await mapshaper.applyCommands('-i country.geojson -o quantization=10000000 output.topojson', {'country.geojson': geojson});
        geojson = JSON.parse(Buffer.from(geojson['output.topojson']).toString('utf-8'));
        fs.writeFile(`${assetsPath}/adm1/${fileName}`, JSON.stringify(geojson), err => {
            if (err) {
                console.error(err);
            }
            else console.log(`${fileName} written`);
        });
    });
    return true
}

getWorldTopojson().then(res => {
    console.log('done');    
});