
const params = {
    width: 850,
    height: 950,
    useViewBox: false,
    longitude: 15,
    latitude: 36,
    altitude: 1000,
    rotation: 0,
    tilt: 25,
    fieldOfView: 50,
    useCanvas: false,
    firstGlow: {
        innerGlow: {blur: 4, strength: 1.4, color: "#7c490eff"},
        outerGlow: {blur: 4, strength: 3, color: '#ffffffff'},
    },
    secondGlow: {
        innerGlow: {blur: 4, strength: 1.4, color: "#A88FAFff"},
        outerGlow: {blur: 4, strength: 3, color: '#ffffffff'},
    },
    useGraticule: true,
    graticuleStep: 3,
    seaColor: "#dce7f8ff",
    land: {
        show: true,
        fillColor: "#ffffffff",
        strokeColor: "#00000000",
        strokeWidth: 1,
        filter: 'firstGlow'
    },
    countries: {
        show: true,
        hover: true,
        hoverColor: "#fbbc0023",
        fillColor: "#f3efec80",
        strokeColor: "#D1BEB038",
        strokeWidth: 2,
    },
    adm1: {
        show: true,
        hover: true,
        hoverColor: "#7c490ea0",
        fillColor: "#ffffffd0",
        strokeColor: "#D1BEB038",
        strokeWidth: 1,
    },
    bgNoise: true,
};

const paramBounds = {
    width: [200, 1500],
    height: [300, 1600],
    longitude: [-180, 180],
    latitude: [-90, 90],
    rotation: [-180, 180],
    tilt: [0, 90],
    altitude: [100, 10000],
    fieldOfView: [1, 180],
    blur: [0.5, 10],
    strength: [0.1, 10],
    graticuleStep: [0.1, 10],
    strokeWidth: [0.1, 5],
};
const filterOptions = {
    none: '',
    firstGlow: 'firstGlow',
    secondGlow: 'secondGlow',
};

export {params, paramBounds, filterOptions};