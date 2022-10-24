const path = require('path');
const sveltePreprocess = require('svelte-preprocess');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

const config = {
    entry: {
        'index': ['./src/index.js']
    },
    resolve: {
        alias: {
            svelte: path.resolve('node_modules', 'svelte')
        },
        extensions: ['.js', '.svelte'],
        mainFields: ['svelte', 'browser', 'module', 'main'],
    },
    output: {
        path: __dirname + '/public',
        filename: '[name].js',
        chunkFilename: '[contenthash].js',
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
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
                test: /\.(png|xlsx|jpg|csv)$/,
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
                        type: 'asset/inline',
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
                test: /\.(txt)$/,
                type: 'asset/source',
            },
            {
                test: /\.(topojson|geojson)$/,
                type: 'json',
            }
        ],
    },
    plugins: [
        new NodePolyfillPlugin()
      ]
};

module.exports = config;