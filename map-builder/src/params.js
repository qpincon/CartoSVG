const params = {
    "General": {
        width: 550,
        height: 600,
        useViewBox: false,
        fieldOfView: 50,
    },
    "Styling": {
        "Border": {
            borderRadius: 15,
            borderWidth: 3,
            borderColor: "#b8b8b8",
        },
        showLand: true,
        showCountries: true,
        useGraticule: true,
        graticuleStep: 3,
        seaColor: "#dce7f8ff",
        backgroundNoise: true,
        firstGlow: {
            innerGlow1: {blur: 4, strength: 1.4, color: "#7c490eff"},
            outerGlow1: {blur: 4, strength: 3, color: '#ffffffff'},
        },
        secondGlow: {
            innerGlow2: {blur: 4, strength: 1.4, color: "#A88FAFff"},
            outerGlow2: {blur: 4, strength: 3, color: '#ffffffff'},
        },
    },

}

const paramDefs = {
    width:          {type: 'range', min: 100, max: 800},
    height:         {type: 'range', min: 100, max: 800},
    fieldOfView:    {type: 'range', min: 1, max: 180},
    blur:           {type: 'range', min: 0.5, max: 10, step: 0.1},
    strength:       {type: 'range', min: 0.1, max: 10, step: 0.1},
    graticuleStep:  {type: 'range', min: 0.1, max: 10, step: 0.1},
    filter:         {type: 'select', choices: ['none', 'firstGlow', 'secondGlow']}
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

export {params, paramDefs, paramBounds, filterOptions};