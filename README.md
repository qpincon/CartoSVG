
[![SVG Scape logo](map-builder/src/assets/img/logo_transparent_text.webp 'SVG Scape logo')](https://svgscape.xyz)

This is the source code of the [SVGScape](https://svgscape.xyz) website. 

## Contribute

You can contribute by submitting an example project, either by:
- creating a pull request
- send me an email at pinconquentin@gmail.com


## Running locally

Tested with node 18

### Dependencies
Run `npm install` to install dependencies

### Develop
Run `npm run dev` to launch webpack with file watching.
Go into `docs/index.html` to test locally.

### Build the project
Run `npm run build` to build the project. All built assets will be in the `docs` directory.  

### Webkit caveats
- Webkit does not support SVG Filters definition in data-URI, so a slightly less performant version of the code is used while waiting for improvments.
- The tooltip, in exported SVG using viewbox, have some positioning issues, because of a bug in foreignObject, which does not scale properly 