const path = require('path');
const sveltePreprocess = require('svelte-preprocess');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');

const examplesMeta = JSON.parse(fs.readFileSync('./examples.json'));
const mode = process.argv.find(x => x.includes('--mode'));
const isProduction = mode.includes('production');
const config = {
    entry: {
        main: './src/entrypoints/index.js',
        about: './src/entrypoints/about.js',
    },
    mode: isProduction ? 'production' : 'development',
    resolve: {
        alias: {
            svelte: path.resolve('node_modules', 'svelte')
        },
        extensions: ['.js', '.svelte'],
        mainFields: ['svelte', 'browser', 'module', 'main']
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        chunkFilename: '[contenthash].js',
    },
    module: {
        rules: [
            {
                test: /\.css$/s,
                oneOf: [
                    {
                        resourceQuery: /inline/,
                        type: 'asset/source',
                    },
                    {
                        use: ["style-loader", "css-loader"],
                    }
                ]
            },
            {
                test: /\.s[ac]ss$/i,
                use: ["style-loader", "css-loader", "sass-loader"],
            },
            {
                test: /\.(html|svelte)$/,
                use: {
                    loader: 'svelte-loader',
                    options: {
                        compilerOptions: {
                            dev: !isProduction
                        },
                        preprocess: sveltePreprocess({
                            scss: {
                                renderSync: true,
                            },
                        }),
                        onwarn: (warning, handler) => {
                            if (warning.code.includes('a11y')) return;
                            if (warning.code === 'security-anchor-rel-noreferrer') return;
                            handler(warning);
                        },

                    }
                },
            },
            {
                test: /\.(png|xlsx|jpg|csv|webp)$/,
                type: 'asset/resource',
            },
            {
                test: /\.(png|jpg)$/,
                resourceQuery: /inline/,
                type: 'asset/inline',
            },
            {
                test: /\.svg$/,
                oneOf: [
                    {
                        resourceQuery: /inline/,
                        type: 'asset/source',
                    },
                    {
                        type: 'asset/resource',
                        use: [
                            {
                                loader: 'svgo-loader',
                                options: {},
                            },
                        ],
                    }
                ]
            },
            {
                test: /\.(topojson|geojson|cartosvg)$/,
                type: 'json',
            }
        ],
    },
    plugins: [
        new NodePolyfillPlugin(),
        new HtmlWebpackPlugin({
            template: './src/index.ejs',
            title: 'CartoSVG - Design gorgeous interactive maps',
            meta: {
                description: 'CartoSVG is a SVG map editor to create, tweak and export rich and splendid visualizations. It allows customization by binding data, displaying tooltips, drawing choropleth, and provides optimizations for exporting the SVG file as light as possible.'
            },
            chunks: ['main'],
            filename: 'app.html',
            favicon: './src/assets/img/logo_transparent.webp'
        }),
        new HtmlWebpackPlugin({
            template: './src/index.ejs',
            title: 'About',
            meta: {
                description: 'CartoSVG aims to be a easy, beautiful and lightweight datamaps replacement.'
            },
            filename: 'about.html',
            chunks: ['about'],
            favicon: './src/assets/img/logo_transparent.webp'
        }),
    ],
};

const svgDefs = [];
Object.entries(examplesMeta).forEach(([exampleName, description]) => {
    config.entry[exampleName] = `./src/examples/${exampleName}.js`;
    const svgDef = {
        content: fs.readFileSync(`./src/examples/${exampleName}.svg`),
        title: description.title,
        description: `See the <a href="${exampleName}.html">standalone example in the app </a> for more information`
    }
    const plugin = new HtmlWebpackPlugin({
        template: './src/index.ejs',
        title: description.title,
        meta: {
            description: description.description
        },
        filename: `${exampleName}.html`,
        chunks: [exampleName],
        favicon: './src/assets/img/logo_transparent.webp',
        svgcontent: svgDef.content
    });
    config.plugins.push(plugin);
    svgDefs.push(svgDef);
});

const frontPagePlugin = new HtmlWebpackPlugin({
    template: './frontPage.ejs',
    favicon: './src/assets/img/logo_transparent.webp',
    svgs: svgDefs,
    inject: false
});
config.plugins.push(frontPagePlugin);

if (!isProduction) {
    config.devtool = 'source-map';
}

module.exports = config;