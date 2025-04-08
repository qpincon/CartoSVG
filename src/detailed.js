export const interestingBasicV2Layers = [
    "Residential",
    "Forest",
    "Sand",
    "Grass",
    "Wood",
    "Water",
    "River",
    "Bridge",
    "Road network",
    "Path minor",
    "Path",
    "Building",
];

export function orderFeaturesByLayer(features) {
    features.sort((a, b) => {
        const layerIdA = interestingBasicV2Layers.indexOf(a.properties.mapLayerId);
        const layerIdB = interestingBasicV2Layers.indexOf(b.properties.mapLayerId);
        if (layerIdA < layerIdB) return -1;
        return 1;
    })

}