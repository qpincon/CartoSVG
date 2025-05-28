import {
    schemeAccent, schemeCategory10, schemeBlues, schemeBrBG, schemeBuGn,
    schemeBuPu, schemeDark2, schemeGnBu, schemeGreens, schemeGreys, schemeObservable10, schemeOrRd, schemeOranges, schemePRGn,
    schemePaired, schemePastel1, schemePastel2, schemePiYG, schemePuBu, schemePuBuGn, schemePuOr, schemePuRd, schemePurples
    , schemeRdBu, schemeRdGy, schemeRdPu, schemeRdYlBu, schemeRdYlGn, schemeReds, schemeSet1, schemeSet2, schemeSet3, schemeSpectral,
    schemeTableau10, schemeYlGn, schemeYlGnBu, schemeYlOrBr, schemeYlOrRd
} from 'd3-scale-chromatic';

export const CATEGORICAL_SCHEMES = {
    "Category10": schemeCategory10,
    "Accent": schemeAccent,
    "Dark": schemeDark2,
    "Paired": schemePaired,
    "Pastel1": schemePastel1,
    "Pastel2": schemePastel2,
    "Set1": schemeSet1,
    "Set2": schemeSet2,
    "Set3": schemeSet3,
    "Tableau10": schemeTableau10,
    "Observable10": schemeObservable10,
}

export const CONTINUOUS_SCHEMES = {
    "Blues": schemeBlues,
    "Greens": schemeGreens,
    "Greys": schemeGreys,
    "Reds": schemeReds,
    "Oranges": schemeOranges,
    "Purples": schemePurples,
    "BuGn": schemeBuGn,
    "BuPu": schemeBuPu,
    "GnBu": schemeGnBu,
    "OrRd": schemeOrRd,
    "PuBuGn": schemePuBuGn,
    "PuBu": schemePuBu,
    "PuRd": schemePuRd,
    "RdPu": schemeRdPu,
    "YlGnBu": schemeYlGnBu,
    "YlGn": schemeYlGn,
    "YlOrBr": schemeYlOrBr,
    "YlOrRd": schemeYlOrRd,
    "BrBG": schemeBrBG,
    "PRGn": schemePRGn,
    "PiYG": schemePiYG,
    "PuOr": schemePuOr,
    "RdBu": schemeRdBu,
    "RdGy": schemeRdGy,
    "RdYlBu": schemeRdYlBu,
    "RdYlGn": schemeRdYlGn,
    "Spectral": schemeSpectral,
}

export type CategoricalScaleKey = keyof typeof CATEGORICAL_SCHEMES;
export type ContinuousScaleKey = keyof typeof CONTINUOUS_SCHEMES;
export type AnyScaleKey = CategoricalScaleKey | ContinuousScaleKey;