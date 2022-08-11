export default {
    plugins: [
      'removeDoctype',
      'removeXMLProcInst',
      'removeComments',
      'removeMetadata',
      'removeEditorsNSData',
      'cleanupAttrs',
      'mergeStyles',
      'inlineStyles',
      'minifyStyles',
      'removeUselessDefs',
      'cleanupNumericValues',
      'convertColors',
      'removeNonInheritableGroupAttrs',
      'removeUselessStrokeAndFill',
      'cleanupEnableBackground',
      'removeHiddenElems',
      'removeEmptyText',
      'convertShapeToPath',
      'convertEllipseToCircle',
      'convertTransform',
      'removeEmptyAttrs',
      'removeEmptyContainers',
      'removeUnusedNS',
      'sortDefsChildren',
      'removeTitle',
      'removeDesc',
      'removeOffCanvasPaths',
      {
        name: 'convertPathData',
        params: {
            applyTransforms: true,
            applyTransformsStroked: true,
            makeArcs: {
                threshold: 2.5, // coefficient of rounding error
                tolerance: 0.5, // percentage of radius
            },
            straightCurves: true,
            lineShorthands: true,
            curveSmoothShorthands: true,
            floatPrecision: 0,
            transformPrecision: 5,
            removeUseless: true,
            collapseRepeated: true,
            utilizeAbsolute: true,
            leadingZero: true,
            negativeExtraSpace: true,
            noSpaceAfterFlags: false, // a20 60 45 0 1 30 20 → a20 60 45 0130 20
            forceAbsolutePath: false,
        }
      },
    ]
  }