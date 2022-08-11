v0.0.35
* Fixed a WKT parsing bug.

v0.0.34
* Changed tmerc to use etmerc for points >3deg from lon_0, unless the +approx flag is used.

v0.0.33
* Added Hill Eucyclic projection.

v0.0.32
* Bug fix

v0.0.31
* Apply default 11.023 degree central meridian to cupola.

v0.0.30
* Updates to the Cupola projection.

v0.0.29
* Added forward spherical formula for the Cupola projection.

v0.0.27
* Fixed bug related to reading UTM South .prj files.

v0.0.26
* Remove source code and other unneeded files from npm distribution.

v0.0.25
* Generate WKT strings with embedded Proj.4 strings as a fallback, like gdal.

v0.0.24
* Expose pj_add() as mproj.pj_add

v0.0.23
* Expose Charles Karney's GeographicLib as mproj.internal.GeographicLib

v0.0.22
* Fix for converting +proj=stere to WKT

v0.0.21
* Ported patterson from PROJ.

v0.0.20
* Fixed webpack compatibility issue.

v0.0.19
* Ported bertin1953 from PROJ.

v0.0.18
* Improvement to eqearth inverse formula.

v0.0.17
* Add Equal Earth projection as "eqearth".

v0.0.16
* Accept library names in either case (e.g. EPSG and epsg).

v0.0.15
* Accept .prj files with "VERTCS" definitions (VERTCS is ignored).

v0.0.14
* Ignore +nadgrids=@null parameters (instead of throwing an error).

v0.0.13
* Added function to search for a cached proj definition file (for mapshaper integration).

v0.0.12
* Added internal function for caching the contents of a proj definition file, to bypass loading from a file.

v0.0.11
* [wkt] Added Gauss_Kruger as an alias of Transverse_Mercator for parsing WKT.
* Changed name of "krass" ellipsoid from "Krassovsky, 1942" to "Krasovsky 1940".

v0.0.10
* Ported more projections and fixes from Proj.4.

v0.0.9
* Ported many more projections from Proj.4.
* Ported commits to Proj.4 through 2017-04-10.

v0.0.8
* Add support for converting Proj.4 definitions to WKT (for generating .prj files)
* Add Goode Homolosine projection

v0.0.7
* Fix npm publishing error

v0.0.6
* Fix error parsing some wkt PROJECTION parameters

v0.0.5
* Add get_proj_defn(), for converting a projection object to a Proj.4 string

v0.0.4
* Add Gilbert projection from libproj4
* Add coords of failed point to error object in pj_transform_point()

v0.0.3
* Add compiled library to npm packages
* Bug fixes

v0.0.2
* Add support for +init= options
* Add Proj.4 libraries for use with +init=
* Add support for translating prj files (WKT) to proj4 strings
