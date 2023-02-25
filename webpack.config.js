const path = require('path');
const sveltePreprocess = require('svelte-preprocess');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');

const examplesMeta = JSON.parse(fs.readFileSync('./examples.json'));

const config = {
    entry: {
        main: './src/entrypoints/index.js',
        about: './src/entrypoints/about.js',
    },
    devtool: 'source-map',
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
                test: /\.(topojson|geojson|svgscape)$/,
                type: 'json',
            }
        ],
    },
    plugins: [
        new NodePolyfillPlugin(),
        new HtmlWebpackPlugin({
            template: './src/index.ejs',
            title: 'SVGscape - Design gorgeous interactive maps',
            meta: {
                description: 'SVGscape is a SVG map editor to create, tweak and export rich and splendid visualizations. It allows customization by binding data, displaying tooltips, drawing choropleth, and provides optimizations for exporting the SVG file as light as possible.'
            },
            chunks: ['main'],
            favicon: './src/assets/img/logo_transparent.webp'
        }),
        new HtmlWebpackPlugin({
            template: './src/index.ejs',
            title: 'About',
            meta: {
                description: 'SVGscape aims to be a easy, beautiful and lightweight datamaps replacement.'
            },
            filename: 'about.html',
            chunks: ['about'],
            favicon: './src/assets/img/logo_transparent.webp'
        }),
    ],
};

Object.entries(examplesMeta).forEach(([exampleName, description]) => {
    config.entry[exampleName] = `./src/examples/${exampleName}.js`;
    const plugin = new HtmlWebpackPlugin({
        template: './src/index.ejs',
        title: description.title,
        meta: {
            description: description.description
        },
        filename: `${exampleName}.html`,
        chunks: [exampleName],
        favicon: './src/assets/img/logo_transparent.webp',
        svgcontent: fs.readFileSync(`./src/examples/${exampleName}.svg`),
    });
    config.plugins.push(plugin);
});
module.exports = config;