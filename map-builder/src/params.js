let defaultParams = {
    "General": {
        width: 550,
        height: 600,
        useViewBox: false,
        fieldOfView: 50,
        altitude: 1000,
    },
    "Styling": {
        "Border": {
            borderRadius: 15,
            borderWidth: 3,
            borderColor: "#b8b8b8",
        },
        showLand: true,
        showCountries: true,
        showGraticule: true,
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
    altitude:       {type: 'range', min: 1, max: 300000},
    blur:           {type: 'range', min: 0.5, max: 10, step: 0.1},
    strength:       {type: 'range', min: 0.1, max: 6, step: 0.1},
    graticuleStep:  {type: 'range', min: 0.1, max: 10, step: 0.1},
    borderRadius:   {type: 'range', min: 0, max: 20},
    borderWidth:    {type: 'range', min: 0, max: 10},
    filter:         {type: 'select', choices: ['none', 'firstGlow', 'secondGlow']}
};


export {defaultParams, paramDefs };