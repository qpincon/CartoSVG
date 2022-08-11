// cast array x into numbers
// get the content of a text node, if any
function nodeVal(x) {
  if (x && x.normalize) {
    x.normalize();
  }
  return (x && x.textContent) || "";
}

// one Y child of X, if any, otherwise null
function get1(x, y) {
  const n = x.getElementsByTagName(y);
  return n.length ? n[0] : null;
}

function getLineStyle(extensions) {
  const style = {};
  if (extensions) {
    const lineStyle = get1(extensions, "line");
    if (lineStyle) {
      const color = nodeVal(get1(lineStyle, "color")),
        opacity = parseFloat(nodeVal(get1(lineStyle, "opacity"))),
        width = parseFloat(nodeVal(get1(lineStyle, "width")));
      if (color) style.stroke = color;
      if (!isNaN(opacity)) style["stroke-opacity"] = opacity;
      // GPX width is in mm, convert to px with 96 px per inch
      if (!isNaN(width)) style["stroke-width"] = (width * 96) / 25.4;
    }
  }
  return style;
}

function getExtensions(node) {
  let values = [];
  if (node !== null) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType !== 1) continue;
      const name = ["heart", "gpxtpx:hr", "hr"].includes(child.nodeName)
        ? "heart"
        : child.nodeName;
      if (name === "gpxtpx:TrackPointExtension") {
        // loop again for nested garmin extensions (eg. "gpxtpx:hr")
        values = values.concat(getExtensions(child));
      } else {
        // push custom extension (eg. "power")
        const val = nodeVal(child);
        values.push([name, isNaN(val) ? val : parseFloat(val)]);
      }
    }
  }
  return values;
}

function getMulti(x, ys) {
  const o = {};
  let n;
  let k;
  for (k = 0; k < ys.length; k++) {
    n = get1(x, ys[k]);
    if (n) o[ys[k]] = nodeVal(n);
  }
  return o;
}
function getProperties$1(node) {
  const prop = getMulti(node, [
    "name",
    "cmt",
    "desc",
    "type",
    "time",
    "keywords",
  ]);
  // Parse additional data from our Garmin extension(s)
  const extensions = node.getElementsByTagNameNS(
    "http://www.garmin.com/xmlschemas/GpxExtensions/v3",
    "*"
  );
  for (let i = 0; i < extensions.length; i++) {
    const extension = extensions[i];
    // Ignore nested extensions, like those on routepoints or trackpoints
    if (extension.parentNode.parentNode === node) {
      prop[extension.tagName.replace(":", "_")] = nodeVal(extension);
    }
  }
  const links = node.getElementsByTagName("link");
  if (links.length) prop.links = [];
  for (let i = 0; i < links.length; i++) {
    prop.links.push(
      Object.assign(
        { href: links[i].getAttribute("href") },
        getMulti(links[i], ["text", "type"])
      )
    );
  }
  return prop;
}

function coordPair$1(x) {
  const ll = [
    parseFloat(x.getAttribute("lon")),
    parseFloat(x.getAttribute("lat")),
  ];
  const ele = get1(x, "ele");
  const time = get1(x, "time");
  if (ele) {
    const e = parseFloat(nodeVal(ele));
    if (!isNaN(e)) {
      ll.push(e);
    }
  }

  return {
    coordinates: ll,
    time: time ? nodeVal(time) : null,
    extendedValues: getExtensions(get1(x, "extensions")),
  };
}
function getRoute(node) {
  const line = getPoints$1(node, "rtept");
  if (!line) return;
  return {
    type: "Feature",
    properties: Object.assign(
      getProperties$1(node),
      getLineStyle(get1(node, "extensions")),
      { _gpxType: "rte" }
    ),
    geometry: {
      type: "LineString",
      coordinates: line.line,
    },
  };
}

function getPoints$1(node, pointname) {
  const pts = node.getElementsByTagName(pointname);
  if (pts.length < 2) return; // Invalid line in GeoJSON

  const line = [];
  const times = [];
  const extendedValues = {};
  for (let i = 0; i < pts.length; i++) {
    const c = coordPair$1(pts[i]);
    line.push(c.coordinates);
    if (c.time) times.push(c.time);
    for (let j = 0; j < c.extendedValues.length; j++) {
      const [name, val] = c.extendedValues[j];
      const plural =
        name === "heart" ? name : name.replace("gpxtpx:", "") + "s";
      if (!extendedValues[plural]) {
        extendedValues[plural] = Array(pts.length).fill(null);
      }
      extendedValues[plural][i] = val;
    }
  }
  return {
    line: line,
    times: times,
    extendedValues: extendedValues,
  };
}

function getTrack(node) {
  const segments = node.getElementsByTagName("trkseg");
  const track = [];
  const times = [];
  const extractedLines = [];

  for (let i = 0; i < segments.length; i++) {
    const line = getPoints$1(segments[i], "trkpt");
    if (line) {
      extractedLines.push(line);
      if (line.times && line.times.length) times.push(line.times);
    }
  }

  if (extractedLines.length === 0) return;

  const multi = extractedLines.length > 1;

  const properties = Object.assign(
    getProperties$1(node),
    getLineStyle(get1(node, "extensions")),
    { _gpxType: "trk" },
    times.length
      ? {
          coordinateProperties: {
            times: multi ? times : times[0],
          },
        }
      : {}
  );

  for (let i = 0; i < extractedLines.length; i++) {
    const line = extractedLines[i];
    track.push(line.line);
    for (const [name, val] of Object.entries(line.extendedValues)) {
      if (!properties.coordinateProperties) {
        properties.coordinateProperties = {};
      }
      const props = properties.coordinateProperties;
      if (multi) {
        if (!props[name])
          props[name] = extractedLines.map((line) =>
            new Array(line.line.length).fill(null)
          );
        props[name][i] = val;
      } else {
        props[name] = val;
      }
    }
  }

  return {
    type: "Feature",
    properties: properties,
    geometry: multi
      ? {
          type: "MultiLineString",
          coordinates: track,
        }
      : {
          type: "LineString",
          coordinates: track[0],
        },
  };
}

function getPoint(node) {
  return {
    type: "Feature",
    properties: Object.assign(getProperties$1(node), getMulti(node, ["sym"])),
    geometry: {
      type: "Point",
      coordinates: coordPair$1(node).coordinates,
    },
  };
}

function* gpxGen(doc) {
  const tracks = doc.getElementsByTagName("trk");
  const routes = doc.getElementsByTagName("rte");
  const waypoints = doc.getElementsByTagName("wpt");

  for (let i = 0; i < tracks.length; i++) {
    const feature = getTrack(tracks[i]);
    if (feature) yield feature;
  }
  for (let i = 0; i < routes.length; i++) {
    const feature = getRoute(routes[i]);
    if (feature) yield feature;
  }
  for (let i = 0; i < waypoints.length; i++) {
    yield getPoint(waypoints[i]);
  }
}

function gpx(doc) {
  return {
    type: "FeatureCollection",
    features: Array.from(gpxGen(doc)),
  };
}

const EXTENSIONS_NS = "http://www.garmin.com/xmlschemas/ActivityExtension/v2";

const TRACKPOINT_ATTRIBUTES = [
  ["heartRate", "heartRates"],
  ["Cadence", "cadences"],
  // Extended Trackpoint attributes
  ["Speed", "speeds"],
  ["Watts", "watts"],
];

const LAP_ATTRIBUTES = [
  ["TotalTimeSeconds", "totalTimeSeconds"],
  ["DistanceMeters", "distanceMeters"],
  ["MaximumSpeed", "maxSpeed"],
  ["AverageHeartRateBpm", "avgHeartRate"],
  ["MaximumHeartRateBpm", "maxHeartRate"],

  // Extended Lap attributes
  ["AvgSpeed", "avgSpeed"],
  ["AvgWatts", "avgWatts"],
  ["MaxWatts", "maxWatts"],
];

function fromEntries(arr) {
  const obj = {};
  for (const [key, value] of arr) {
    obj[key] = value;
  }
  return obj;
}

function getProperties(node, attributeNames) {
  const properties = [];

  for (const [tag, alias] of attributeNames) {
    let elem = get1(node, tag);
    if (!elem) {
      const elements = node.getElementsByTagNameNS(EXTENSIONS_NS, tag);
      if (elements.length) {
        elem = elements[0];
      }
    }
    const val = parseFloat(nodeVal(elem));
    if (!isNaN(val)) {
      properties.push([alias, val]);
    }
  }

  return properties;
}

function coordPair(x) {
  const lon = nodeVal(get1(x, "LongitudeDegrees"));
  const lat = nodeVal(get1(x, "LatitudeDegrees"));
  if (!lon.length || !lat.length) {
    return null;
  }
  const ll = [parseFloat(lon), parseFloat(lat)];
  const alt = get1(x, "AltitudeMeters");
  const heartRate = get1(x, "HeartRateBpm");
  const time = get1(x, "Time");
  let a;
  if (alt) {
    a = parseFloat(nodeVal(alt));
    if (!isNaN(a)) {
      ll.push(a);
    }
  }
  return {
    coordinates: ll,
    time: time ? nodeVal(time) : null,
    heartRate: heartRate ? parseFloat(nodeVal(heartRate)) : null,
    extensions: getProperties(x, TRACKPOINT_ATTRIBUTES),
  };
}

function getPoints(node, pointname) {
  const pts = node.getElementsByTagName(pointname);
  const line = [];
  const times = [];
  const heartRates = [];
  if (pts.length < 2) return null; // Invalid line in GeoJSON
  const result = { extendedProperties: {} };
  for (let i = 0; i < pts.length; i++) {
    const c = coordPair(pts[i]);
    if (c === null) continue;
    line.push(c.coordinates);
    if (c.time) times.push(c.time);
    if (c.heartRate) heartRates.push(c.heartRate);
    for (const [alias, value] of c.extensions) {
      if (!result.extendedProperties[alias]) {
        result.extendedProperties[alias] = Array(pts.length).fill(null);
      }
      result.extendedProperties[alias][i] = value;
    }
  }
  return Object.assign(result, {
    line: line,
    times: times,
    heartRates: heartRates,
  });
}

function getLap(node) {
  const segments = node.getElementsByTagName("Track");
  const track = [];
  const times = [];
  const heartRates = [];
  const allExtendedProperties = [];
  let line;
  const properties = fromEntries(getProperties(node, LAP_ATTRIBUTES));

  const nameElement = get1(node, "Name");
  if (nameElement) {
    properties.name = nodeVal(nameElement);
  }

  for (let i = 0; i < segments.length; i++) {
    line = getPoints(segments[i], "Trackpoint");
    if (line) {
      track.push(line.line);
      if (line.times.length) times.push(line.times);
      if (line.heartRates.length) heartRates.push(line.heartRates);
      allExtendedProperties.push(line.extendedProperties);
    }
  }
  for (let i = 0; i < allExtendedProperties.length; i++) {
    const extendedProperties = allExtendedProperties[i];
    for (const property in extendedProperties) {
      if (segments.length === 1) {
        properties[property] = line.extendedProperties[property];
      } else {
        if (!properties[property]) {
          properties[property] = track.map((track) =>
            Array(track.length).fill(null)
          );
        }
        properties[property][i] = extendedProperties[property];
      }
    }
  }
  if (track.length === 0) return;

  if (times.length || heartRates.length) {
    properties.coordinateProperties = Object.assign(
      times.length
        ? {
            times: track.length === 1 ? times[0] : times,
          }
        : {},
      heartRates.length
        ? {
            heart: track.length === 1 ? heartRates[0] : heartRates,
          }
        : {}
    );
  }

  return {
    type: "Feature",
    properties: properties,
    geometry: {
      type: track.length === 1 ? "LineString" : "MultiLineString",
      coordinates: track.length === 1 ? track[0] : track,
    },
  };
}

function* tcxGen(doc) {
  const laps = doc.getElementsByTagName("Lap");

  for (let i = 0; i < laps.length; i++) {
    const feature = getLap(laps[i]);
    if (feature) yield feature;
  }

  const courses = doc.getElementsByTagName("Courses");

  for (let i = 0; i < courses.length; i++) {
    const feature = getLap(courses[i]);
    if (feature) yield feature;
  }
}

function tcx(doc) {
  return {
    type: "FeatureCollection",
    features: Array.from(tcxGen(doc)),
  };
}

const removeSpace = /\s*/g;
const trimSpace = /^\s*|\s*$/g;
const splitSpace = /\s+/;

// generate a short, numeric hash of a string
function okhash(x) {
  if (!x || !x.length) return 0;
  let h = 0;
  for (let i = 0; i < x.length; i++) {
    h = ((h << 5) - h + x.charCodeAt(i)) | 0;
  }
  return h;
}

// get one coordinate from a coordinate array, if any
function coord1(v) {
  return v.replace(removeSpace, "").split(",").map(parseFloat);
}

// get all coordinates from a coordinate array as [[],[]]
function coord(v) {
  return v.replace(trimSpace, "").split(splitSpace).map(coord1);
}

function xml2str(node) {
  if (node.xml !== undefined) return node.xml;
  if (node.tagName) {
    let output = node.tagName;
    for (let i = 0; i < node.attributes.length; i++) {
      output += node.attributes[i].name + node.attributes[i].value;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      output += xml2str(node.childNodes[i]);
    }
    return output;
  }
  if (node.nodeName === "#text") {
    return (node.nodeValue || node.value || "").trim();
  }
  if (node.nodeName === "#cdata-section") {
    return node.nodeValue;
  }
  return "";
}

const geotypes = ["Polygon", "LineString", "Point", "Track", "gx:Track"];

function kmlColor(properties, elem, prefix) {
  let v = nodeVal(get1(elem, "color")) || "";
  const colorProp =
    prefix == "stroke" || prefix === "fill" ? prefix : prefix + "-color";
  if (v.substr(0, 1) === "#") {
    v = v.substr(1);
  }
  if (v.length === 6 || v.length === 3) {
    properties[colorProp] = v;
  } else if (v.length === 8) {
    properties[prefix + "-opacity"] = parseInt(v.substr(0, 2), 16) / 255;
    properties[colorProp] =
      "#" + v.substr(6, 2) + v.substr(4, 2) + v.substr(2, 2);
  }
}

function numericProperty(properties, elem, source, target) {
  const val = parseFloat(nodeVal(get1(elem, source)));
  if (!isNaN(val)) properties[target] = val;
}

function gxCoords(root) {
  let elems = root.getElementsByTagName("coord");
  const coords = [];
  const times = [];
  if (elems.length === 0) elems = root.getElementsByTagName("gx:coord");
  for (let i = 0; i < elems.length; i++) {
    coords.push(nodeVal(elems[i]).split(" ").map(parseFloat));
  }
  const timeElems = root.getElementsByTagName("when");
  for (let j = 0; j < timeElems.length; j++) times.push(nodeVal(timeElems[j]));
  return {
    coords: coords,
    times: times,
  };
}

function getGeometry(root) {
  let geomNode;
  let geomNodes;
  let i;
  let j;
  let k;
  const geoms = [];
  const coordTimes = [];
  if (get1(root, "MultiGeometry")) {
    return getGeometry(get1(root, "MultiGeometry"));
  }
  if (get1(root, "MultiTrack")) {
    return getGeometry(get1(root, "MultiTrack"));
  }
  if (get1(root, "gx:MultiTrack")) {
    return getGeometry(get1(root, "gx:MultiTrack"));
  }
  for (i = 0; i < geotypes.length; i++) {
    geomNodes = root.getElementsByTagName(geotypes[i]);
    if (geomNodes) {
      for (j = 0; j < geomNodes.length; j++) {
        geomNode = geomNodes[j];
        if (geotypes[i] === "Point") {
          geoms.push({
            type: "Point",
            coordinates: coord1(nodeVal(get1(geomNode, "coordinates"))),
          });
        } else if (geotypes[i] === "LineString") {
          geoms.push({
            type: "LineString",
            coordinates: coord(nodeVal(get1(geomNode, "coordinates"))),
          });
        } else if (geotypes[i] === "Polygon") {
          const rings = geomNode.getElementsByTagName("LinearRing"),
            coords = [];
          for (k = 0; k < rings.length; k++) {
            coords.push(coord(nodeVal(get1(rings[k], "coordinates"))));
          }
          geoms.push({
            type: "Polygon",
            coordinates: coords,
          });
        } else if (geotypes[i] === "Track" || geotypes[i] === "gx:Track") {
          const track = gxCoords(geomNode);
          geoms.push({
            type: "LineString",
            coordinates: track.coords,
          });
          if (track.times.length) coordTimes.push(track.times);
        }
      }
    }
  }
  return {
    geoms: geoms,
    coordTimes: coordTimes,
  };
}

function getPlacemark(root, styleIndex, styleMapIndex, styleByHash) {
  const geomsAndTimes = getGeometry(root);
  let i;
  const properties = {};
  const name = nodeVal(get1(root, "name"));
  const address = nodeVal(get1(root, "address"));
  let styleUrl = nodeVal(get1(root, "styleUrl"));
  const description = nodeVal(get1(root, "description"));
  const timeSpan = get1(root, "TimeSpan");
  const timeStamp = get1(root, "TimeStamp");
  const extendedData = get1(root, "ExtendedData");
  let iconStyle = get1(root, "IconStyle");
  let labelStyle = get1(root, "LabelStyle");
  let lineStyle = get1(root, "LineStyle");
  let polyStyle = get1(root, "PolyStyle");
  const visibility = get1(root, "visibility");

  if (name) properties.name = name;
  if (address) properties.address = address;
  if (styleUrl) {
    if (styleUrl[0] !== "#") {
      styleUrl = "#" + styleUrl;
    }

    properties.styleUrl = styleUrl;
    if (styleIndex[styleUrl]) {
      properties.styleHash = styleIndex[styleUrl];
    }
    if (styleMapIndex[styleUrl]) {
      properties.styleMapHash = styleMapIndex[styleUrl];
      properties.styleHash = styleIndex[styleMapIndex[styleUrl].normal];
    }
    // Try to populate the lineStyle or polyStyle since we got the style hash
    const style = styleByHash[properties.styleHash];
    if (style) {
      if (!iconStyle) iconStyle = get1(style, "IconStyle");
      if (!labelStyle) labelStyle = get1(style, "LabelStyle");
      if (!lineStyle) lineStyle = get1(style, "LineStyle");
      if (!polyStyle) polyStyle = get1(style, "PolyStyle");
    }
  }
  if (description) properties.description = description;
  if (timeSpan) {
    const begin = nodeVal(get1(timeSpan, "begin"));
    const end = nodeVal(get1(timeSpan, "end"));
    properties.timespan = { begin: begin, end: end };
  }
  if (timeStamp) {
    properties.timestamp = nodeVal(get1(timeStamp, "when"));
  }
  if (iconStyle) {
    kmlColor(properties, iconStyle, "icon");
    numericProperty(properties, iconStyle, "scale", "icon-scale");
    numericProperty(properties, iconStyle, "heading", "icon-heading");

    const hotspot = get1(iconStyle, "hotSpot");
    if (hotspot) {
      const left = parseFloat(hotspot.getAttribute("x"));
      const top = parseFloat(hotspot.getAttribute("y"));
      if (!isNaN(left) && !isNaN(top)) properties["icon-offset"] = [left, top];
    }
    const icon = get1(iconStyle, "Icon");
    if (icon) {
      const href = nodeVal(get1(icon, "href"));
      if (href) properties.icon = href;
    }
  }
  if (labelStyle) {
    kmlColor(properties, labelStyle, "label");
    numericProperty(properties, labelStyle, "scale", "label-scale");
  }
  if (lineStyle) {
    kmlColor(properties, lineStyle, "stroke");
    numericProperty(properties, lineStyle, "width", "stroke-width");
  }
  if (polyStyle) {
    kmlColor(properties, polyStyle, "fill");
    const fill = nodeVal(get1(polyStyle, "fill"));
    const outline = nodeVal(get1(polyStyle, "outline"));
    if (fill)
      properties["fill-opacity"] =
        fill === "1" ? properties["fill-opacity"] || 1 : 0;
    if (outline)
      properties["stroke-opacity"] =
        outline === "1" ? properties["stroke-opacity"] || 1 : 0;
  }
  if (extendedData) {
    const datas = extendedData.getElementsByTagName("Data"),
      simpleDatas = extendedData.getElementsByTagName("SimpleData");

    for (i = 0; i < datas.length; i++) {
      properties[datas[i].getAttribute("name")] = nodeVal(
        get1(datas[i], "value")
      );
    }
    for (i = 0; i < simpleDatas.length; i++) {
      properties[simpleDatas[i].getAttribute("name")] = nodeVal(simpleDatas[i]);
    }
  }
  if (visibility) {
    properties.visibility = nodeVal(visibility);
  }
  if (geomsAndTimes.coordTimes.length) {
    properties.coordinateProperties = {
      times:
        geomsAndTimes.coordTimes.length === 1
          ? geomsAndTimes.coordTimes[0]
          : geomsAndTimes.coordTimes,
    };
  }
  const feature = {
    type: "Feature",
    geometry:
      geomsAndTimes.geoms.length === 0
        ? null
        : geomsAndTimes.geoms.length === 1
        ? geomsAndTimes.geoms[0]
        : {
            type: "GeometryCollection",
            geometries: geomsAndTimes.geoms,
          },
    properties: properties,
  };
  if (root.getAttribute("id")) feature.id = root.getAttribute("id");
  return feature;
}

function* kmlGen(doc) {
  // styleindex keeps track of hashed styles in order to match feature
  const styleIndex = {};
  const styleByHash = {};
  // stylemapindex keeps track of style maps to expose in properties
  const styleMapIndex = {};
  // atomic geospatial types supported by KML - MultiGeometry is
  // handled separately
  // all root placemarks in the file
  const placemarks = doc.getElementsByTagName("Placemark");
  const styles = doc.getElementsByTagName("Style");
  const styleMaps = doc.getElementsByTagName("StyleMap");

  for (let k = 0; k < styles.length; k++) {
    const style = styles[k];
    const hash = okhash(xml2str(style)).toString(16);
    let id = style.getAttribute("id");
    if (
      !id &&
      style.parentNode.tagName.replace("gx:", "") === "CascadingStyle"
    ) {
      id =
        style.parentNode.getAttribute("kml:id") ||
        style.parentNode.getAttribute("id");
    }
    styleIndex["#" + id] = hash;
    styleByHash[hash] = style;
  }
  for (let l = 0; l < styleMaps.length; l++) {
    styleIndex["#" + styleMaps[l].getAttribute("id")] = okhash(
      xml2str(styleMaps[l])
    ).toString(16);
    const pairs = styleMaps[l].getElementsByTagName("Pair");
    const pairsMap = {};
    for (let m = 0; m < pairs.length; m++) {
      pairsMap[nodeVal(get1(pairs[m], "key"))] = nodeVal(
        get1(pairs[m], "styleUrl")
      );
    }
    styleMapIndex["#" + styleMaps[l].getAttribute("id")] = pairsMap;
  }
  for (let j = 0; j < placemarks.length; j++) {
    const feature = getPlacemark(
      placemarks[j],
      styleIndex,
      styleMapIndex,
      styleByHash
    );
    if (feature) yield feature;
  }
}

function kml(doc) {
  return {
    type: "FeatureCollection",
    features: Array.from(kmlGen(doc)),
  };
}

export { gpx, gpxGen, kml, kmlGen, tcx, tcxGen };
//# sourceMappingURL=togeojson.es.js.map
