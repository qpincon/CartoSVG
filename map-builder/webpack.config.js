const path = require('path');
const sveltePreprocess = require('svelte-preprocess');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');

const config = {
    entry: {
        main: './src/index.js',
        about: './src/about.js'
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
                        })
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
                test: /\.(topojson|geojson)$/,
                type: 'json',
            }
        ],
    },
    plugins: [
        new NodePolyfillPlugin(),
        new HtmlWebpackPlugin({
            title: 'SVGscape - Easiest way to draw beautiful, interactive and lightweight SVG maps',
            meta: {
                description: 'SVGscape is an online editor to create, tweak and export rich and splendid SVG map visualizations. It allows customization by binding data, displaying tooltips, drawing choropleth, and provides optimizations for exporting the SVG file as light as possible.'
            },
            chunks: ['main'],
        }),
        new HtmlWebpackPlugin({
            title: 'SVGscape - About',
            meta: {
                description: 'SVGscape aims to be a easy, beautiful and lightweight datamaps replacement.'
            },
            filename: 'about.html',
            chunks: ['about'],
          })
        
    ],
    // devServer: {

    //     static: './docs',

    // },
    mode: 'development',

};

module.exports = config;