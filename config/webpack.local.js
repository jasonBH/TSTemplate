const webpack = require('webpack')
const path = require('path');
const glob = require('glob');

var PATH_root = path.resolve(__dirname, '../');
var PATH_src = path.resolve(PATH_root, './src');
var PATH_bindev = path.resolve(PATH_root, './bin_dev');
var PATH_bin = path.resolve(PATH_root, './bin');
var PATH_nodeMod = path.resolve(PATH_root, './node_modules');

// console.log("PATH_src:"+PATH_src+"\n")

// production | development
var NODE_ENV = process.env.NODE_ENV;
var isDev = NODE_ENV=="development";
// console.log("env:", NODE_ENV);
var minimist = require('minimist');
// console.log("run parameter:", minimist(process.argv).dev);


/* 以 src 目录为基准 */
var pathmap = require('./pathmap.json');
// console.log("pathmap:", pathmap)
var getPathToSrc = function(_path){
    return path.resolve(PATH_src, _path);
}


//输出目录
var out_bin = isDev ? PATH_bindev : PATH_bin;
//输出chunkhash
var out_chunkhash = isDev ? "" : ".[chunkhash]";
var out_hash = isDev ? "" : ".[hash]";

//entry
var entries = function(){
    var entryTSs = glob.sync(getPathToSrc(pathmap.pathTs));
    var entryJSs = glob.sync(getPathToSrc(pathmap.pathJs));
    var entryList = entryTSs.concat(entryJSs);
    var map = {};
    for(var i=0; i<entryList.length; i++){
        var filePath = entryList[i];
        // console.log(filePath)
        var fileName = filePath.substring(filePath.lastIndexOf('\/')+1, filePath.lastIndexOf('.'));
        map[fileName] = filePath;
    }
    return map;
}

//pulgins
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin');
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin')


var plugins = [];

var plugin_html = function(){
    var ehtmllist = glob.sync(getPathToSrc(pathmap.pathHtml));
    var plus = [];
    var entriesFiles = entries();
    for(var i=0; i<ehtmllist.length; i++){
        var filePath = ehtmllist[i];
        var fileName = filePath.substring(filePath.lastIndexOf('\/')+1, filePath.lastIndexOf('.'));
        var conf = {
            template:filePath,
            filename:fileName+'.html'
        }
        if(fileName in entriesFiles){
            conf.inject = 'body';
            conf.chunks = ["common", fileName];
        }
        // conf.favicon = getPathToSrc(pathmap.favicon);
        plus.push(new HtmlWebpackPlugin(conf));
    }
    return plus;
}
plugins = plugins.concat(plugin_html());


//抽取css
const extractCSS = new ExtractTextPlugin({
    filename: "css/[name]"+out_chunkhash+".css"
});
const extractSass = new ExtractTextPlugin({
    filename: "css/[name]"+out_chunkhash+".css",
    disable: isDev
});

plugins.push(
    extractCSS,
    extractSass,
    //抽取公共库/代码，配合entry使用//页面上使用的时候最后一个会块最先加载,其它依次加载
    new webpack.optimize.CommonsChunkPlugin({
        "names": ["common"],
        "filename": "views/[name]"+out_chunkhash+".js",
        minChunks: function (module, count) {
            // any required modules inside node_modules are extracted to common
            return (
              module.resource &&
              /\.js$/.test(module.resource) &&
              module.resource.indexOf(
                path.join(__dirname, '../node_modules')
              ) === 0
            )
        }
    }),
    new webpack.DefinePlugin({
        'process.env': {NODE_ENV: JSON.stringify(NODE_ENV)}
    }),
    //抽取css
    // new ExtractTextPlugin("css/[name]"+out_chunkhash+".css"),
    //复制目录/文件
    new CopyWebpackPlugin([
        {
          from: getPathToSrc(pathmap.pathStatic),
          to: path.resolve(out_bin, pathmap.pathStatic),
          ignore: ['.*']
        }
    ])
);

if(isDev){
    plugins.push(
        new FriendlyErrorsPlugin(),
        new webpack.HotModuleReplacementPlugin()
    )
}

if(isDev==false) plugins.push(new OptimizeCSSPlugin({
    cssProcessorOptions: {
      safe: true,
      discardComments: { //删除css注释
        removeAll: true
      }
    }
  }));

//暴露的库
// plugins.push(
    // new webpack.ProvidePlugin({"$":"jquery", "jQuery":"jquery"}),
    // new webpack.ProvidePlugin({"_":"lodash"})
    // new webpack.ProvidePlugin({"Vue":"vue"})
// )
//生产环境 清除/压缩
if(isDev==false){
    plugins.unshift(
        new CleanWebpackPlugin(out_bin, PATH_root),
        new webpack.optimize.UglifyJsPlugin({
            sourceMap: true
        })
    );
}





var config = {
    entry:Object.assign(entries(), {

    }),
    output:{
        path:out_bin,
        filename:'views/[name]'+out_chunkhash+'.js',
        chunkFilename:'modules/[name]'+out_chunkhash+'.js',
        publicPath:'/',
    },
    module:{
        // noParse:'/vue/',
        rules:[
            {
                test: /\.vue$/,
                loader:'vue-loader',
                options:{
                    // loaders: { js: 'vue-ts-loader' },
                    esModule: true,
                    postcss: [
                        require('autoprefixer')({
                            browsers: ['last 2 versions']
                        })
                    ]
                }
            },
            {
                test:/\.ts$/,
                loader:'ts-loader',
                options:{
                    appendTsSuffixTo: [/\.vue$/]//<script lang="ts">
                }
            },
            {
                test:/\.js$/,
                exclude:[PATH_nodeMod],
                include: [PATH_src],
                loader:"babel-loader"
            },
            {
                test: /\.css$/,
                exclude:[PATH_nodeMod],
                use: extractCSS.extract({
                    fallback: "style-loader",
                    use: "css-loader"
                })
            },
            {
                test:/\.scss|.sass$/i,
                use:extractSass.extract({
                    use: [{ loader: "css-loader" }, { loader: "sass-loader" }],
                    // 在开发环境使用 style-loader
                    fallback: "style-loader"
                })
            },
            {
                test:/\.html$/,
                use:'html-loader'
            },
            {
                test:/\.(png|jpg|jpeg|gif|eot|ttf|woff|woff2|svg|svgz)(\?.+)?$/,
                loader:'file-loader',
                options:{
                    name:'images/[name]'+out_hash+'.[ext]',
                }
            }
        ]
    },
    devtool: isDev ? 'source-map': false,
    plugins:plugins,
    resolve: {
        modules: [PATH_root+"/node_modules/", PATH_src],
        extensions: ['.js', '.ts', '.vue', '.css', '.scss','.sass', '.json'],
        alias: Object.assign(
            pathmap.lib,
            {
                "@":PATH_src,
            }
        )
    },
    externals:{

    },
}

if(isDev){
    Object.keys(config.entry).forEach(function (name) {
        config.entry[name] = ['./build/dev-client'].concat(config.entry[name])
    })
}


module.exports = config;