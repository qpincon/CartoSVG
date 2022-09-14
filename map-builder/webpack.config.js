const path = require('path');
const sveltePreprocess = require('svelte-preprocess');

const config = {
    entry: {
        'index': ['./src/index.js']
    },
    resolve: {
        alias: {
            svelte: path.resolve('node_modules', 'svelte')
        },
        extensions: ['.js', '.svelte'],
        mainFields: ['svelte', 'browser', 'module', 'main']
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
                test: /\.(svg|png|xlsx|csv)$/,
                type: 'asset/resource',
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
};

module.exports = config;