import fs from 'node:fs';
import mapshaper from 'mapshaper';

// run: bun run getAndSimplifyWorld.ts
const assetsPath = '/home/quentin/Tests/CartoSVG/src/assets/layers';
async function getWorldTopojson(){
    if(fs.existsSync(assetsPath)) {
        fs.rmSync(assetsPath, {recursive: true});
    }
    fs.mkdirSync(assetsPath);
    let topology = await fetch('https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM1.geojson');
    topology = await topology.json();
    console.log('Topology adm1 downloaded');
    let simplified = await mapshaper.applyCommands('-i topo.geojson -rename-fields name=shapeName -simplify 3.5% -clean -o output.geojson', {'topo.geojson': topology});
    console.log('Simplification ADM1 done');
    simplified = JSON.parse(Buffer.from(simplified['output.geojson']).toString('utf-8'));
    fs.writeFileSync(`${assetsPath}/adm1_simplified.geojson`, JSON.stringify(simplified));

    await mapshaper.runCommands(`-i ${assetsPath}/adm1_simplified.geojson -dissolve shapeGroup -clean -o quantization=100000000000 ${assetsPath}/world_adm0_simplified.topojson`);
    await mapshaper.runCommands(`-i ${assetsPath}/world_adm0_simplified.topojson -simplify 10% -dissolve -clean -o quantization=100000000000 ${assetsPath}/world_land_very_simplified.topojson`);
    fs.mkdirSync(`${assetsPath}/adm1`);
    await mapshaper.runCommands(`-i ${assetsPath}/adm1_simplified.geojson -split shapeGroup -o format=topojson singles quantization=100000000000 ${assetsPath}/adm1/`);
    fs.unlinkSync(`${assetsPath}/adm1_simplified.geojson`);
    
    let topologyAdm2 = await fetch('https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM2.geojson');
    topologyAdm2 = await topologyAdm2.json();
    console.log('Topology ADM2 downloaded');
    let simplifiedAdm2 = await mapshaper.applyCommands('-i topo.geojson -rename-fields name=shapeName -simplify 2% -clean -o output.geojson', {'topo.geojson': topologyAdm2});
    console.log('Simplification ADM2 done');
    simplifiedAdm2 = JSON.parse(Buffer.from(simplifiedAdm2['output.geojson']).toString('utf-8'));
    fs.writeFileSync(`${assetsPath}/adm2_simplified.geojson`, JSON.stringify(simplifiedAdm2));
    fs.mkdirSync(`${assetsPath}/adm2`);
    await mapshaper.runCommands(`-i ${assetsPath}/adm2_simplified.geojson -filter 'shapeType==="ADM2"' -split shapeGroup -o format=topojson singles quantization=100000000000 ${assetsPath}/adm2/`);
    fs.unlinkSync(`${assetsPath}/adm2_simplified.geojson`);
    return true;
}


getWorldTopojson().then(res => {
    console.log('done');    
});
