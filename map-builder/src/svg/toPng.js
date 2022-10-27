

function svgToPng(b64, width, height) {
    base64SvgToBase64Png(b64, width, height).then(pngSrc => {
        const link = document.createElement("a");
        link.download = 'map.png';
        link.href = pngSrc;
        console.log(pngSrc)
        link.click();
  });
}

/**
 * converts a base64 encoded data url SVG image to a PNG image
 * @param originalBase64 data url of svg image
 * @param width target width in pixel of PNG image
 * @param secondTry used internally to prevent endless recursion
 * @return {Promise<unknown>} resolves to png data url of the image
 */
function base64SvgToBase64Png(originalBase64, width, height, secondTry) {
    return new Promise(resolve => {
        const img = document.createElement('img');
        img.onload = function () {
            if (!secondTry && (img.naturalWidth === 0 || img.naturalHeight === 0)) {
                const svgDoc = base64ToSvgDocument(originalBase64);
                const fixedDoc = fixSvgDocumentFF(svgDoc);
                return base64SvgToBase64Png(svgDocumentToBase64(fixedDoc), width, height, true).then(result => {
                    resolve(result);
                });
            }
            document.body.appendChild(img);
            const canvas = document.createElement("canvas");
            document.body.removeChild(img);
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            try {
                const data = canvas.toDataURL('image/png');
                resolve(data);
            } catch (e) {
                resolve(null);
            }
        };
        img.src = originalBase64;
    });
}

//needed because Firefox doesn't correctly handle SVG with size = 0, see https://bugzilla.mozilla.org/show_bug.cgi?id=700533
function fixSvgDocumentFF(svgDocument) {
    try {
        let widthInt = parseInt(svgDocument.documentElement.width.baseVal.value) || 500;
        let heightInt = parseInt(svgDocument.documentElement.height.baseVal.value) || 500;
        svgDocument.documentElement.width.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX, widthInt);
        svgDocument.documentElement.height.baseVal.newValueSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX, heightInt);
        return svgDocument;
    } catch (e) {
        return svgDocument;
    }
}

function svgDocumentToBase64(svgDocument) {
    try {
        let base64EncodedSVG = window.btoa(new XMLSerializer().serializeToString(svgDocument));
        return 'data:image/svg+xml;base64,' + base64EncodedSVG;
    } catch (e) {
        return null;
    }
}

function base64ToSvgDocument(base64) {
    let svg = window.atob(base64.substring(base64.indexOf('base64,') + 7));
    svg = svg.substring(svg.indexOf('<svg'));
    let parser = new DOMParser();
    return parser.parseFromString(svg, "image/svg+xml");
}

export { svgToPng };