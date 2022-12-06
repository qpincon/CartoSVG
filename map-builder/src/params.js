let defaultParams = {
    General: {
        width: 600,
        height: 670,
        useViewBox: false,
        fieldOfView: 50,
        altitude: 3200,
    },
    Border: {
        borderRadius: 15,
        borderWidth: 3,
        borderColor: "#b8b8b8",
    },
    Background: {
        showGraticule: true,
        graticuleStep: 3,
        seaColor: "#dde2eeff",
        backgroundNoise: true,
    },
    firstGlow: {
        innerBlur: 2.1, innerStrength: 0.1, innerColor: "#7c490eff",
        outerBlur: 3.5, outerStrength: 0.1, outerColor: '#ffffffff',
    },
    secondGlow: {
        innerBlur: 0.2, innerStrength: 3.0, innerColor: "#2f65ffff",
        outerBlur: 4, outerBlur: 3, outerColor: '#2d2626ff',
    },
}

const paramDefs = {
    width:          {type: 'range', min: 100, max: 800},
    height:         {type: 'range', min: 100, max: 800},
    fieldOfView:    {type: 'range', min: 1, max: 180},
    altitude:       {type: 'range', min: 1, max: 300000, step: 10},
    innerBlur:           {type: 'range', min: 0, max: 10, step: 0.1},
    innerStrength:       {type: 'range', min: 0.1, max: 6, step: 0.1},
    graticuleStep:  {type: 'range', min: 0.1, max: 10, step: 0.1},
    borderRadius:   {type: 'range', min: 0, max: 20},
    borderWidth:    {type: 'range', min: 0, max: 10},
    filter:         {type: 'select', choices: ['none', 'firstGlow', 'secondGlow']}
};
paramDefs['outerBlur'] = paramDefs['innerBlur'];
paramDefs['outerStrength'] = paramDefs['innerStrength'];

const glowHelpGeneral = `The glow effect is used by default on the "land" layer. You can tweak the parameters on how the inner and outer effect are achieved.`;
const blurHelp = "The quantity of blur applied on the glow.";
const strengthHelp = "The thickness of the glow effect.";
const helpParams = {
    firstGlow: glowHelpGeneral,
    secondGlow: glowHelpGeneral,
    innerBlur: blurHelp, 
    innerStrength: strengthHelp,
    useViewBox: `If checked, the exported SVG will fit to its container and will not define its own width/height.`,
};

export {defaultParams, paramDefs, helpParams };