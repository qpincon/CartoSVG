
[![SVG Scape logo](src/assets/img/logo_brand.webp 'SVG Scape logo')](https://cartosvg.com)

This is the source code of the [CartoSVG](https://cartosvg.com) website. 

## Contribute

You can contribute by submitting an example project, either by:
- creating a pull request
- send me an email at pincon.quentin@gmail.com


## Running locally

Tested with node 18

### Dependencies
Run `npm install` to install dependencies

### Develop
Run `npm run dev` to launch webpack with file watching.
Go into `dist/index.html` to test locally.

### Build the project
Run `npm run build` to build the project. All built assets will be in the `dist` directory.  

### Webkit caveats
- Webkit does not support SVG Filters definition in data-URI, so a slightly less performant version of the code is used while waiting for improvments.
- The tooltip, in exported SVG using viewbox, have some positioning issues, because of a bug in foreignObject, which does not scale properly 