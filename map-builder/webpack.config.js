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
    resolve: {
        alias: {
            svelte: path.resolve('node_modules', 'svelte')
        },
        extensions: ['.js', '.svelte'],
        mainFields: ['svelte', 'browser', 'module', 'main'],
    },
    output: {
        path: path.resolve(__dirname, '../docs'),
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
                        use: [
                            {
                                loader: 'svgo-loader',
                                options: {},
                            },
                        ],
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
            title: 'SVGscape - Draw gorgeous interactive maps with ease',
            meta: {
                description: 'SVGscape is an online editor to create, tweak and export rich and splendid SVG map visualizations. It allows customization by binding data, displaying tooltips, drawing choropleth, and provides optimizations for exporting the SVG file as light as possible.'
            },
            chunks: ['main'],
            favicon: './src/assets/img/logo_transparent.webp'
        }),
        new HtmlWebpackPlugin({
            title: 'About',
            meta: {
                description: 'SVGscape aims to be a easy, beautiful and lightweight datamaps replacement.'
            },
            filename: 'about.html',
            chunks: ['about'],
            favicon: './src/assets/img/logo_transparent.webp'
        })
    ],
    mode: 'development',
};

Object.entries(examplesMeta).forEach(([exampleName, description]) => {
    config.entry[exampleName] = `./src/examples/${exampleName}.js`;
    const plugin = new HtmlWebpackPlugin({
        title: description.title,
        meta: {
            description: description.description
        },
        filename: `${exampleName}.html`,
        chunks: [exampleName],
        favicon: './src/assets/img/logo_transparent.webp'
    });
    config.plugins.push(plugin);
});
module.exports = config;