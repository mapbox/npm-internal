#!/usr/bin/env node
var npm  = require("npm");
var AWS = require("aws-sdk");
var fs = require("fs");
var config = require('rc')("npm-internal",{acl:"public-read"});

var crypto = require('crypto');
var shasum = crypto.createHash('sha1');

shasum.update((+(new Date()))+Math.random()+"");
var hash = shasum.digest('hex');

var command = (process.argv.length > 2) ? process.argv[2] : false;
var option = (process.argv.length > 3) ? process.argv[3] : "";

if(command === "config"){
    promptForConfig()
}else if(!config.accessKeyId  || !config.secretAccessKey || !config.bucket || !command ){
    fs.createReadStream(__dirname + '/usage.md').on('end', function(){
        if(command === "publish") promptForConfig(); 
    }).pipe(process.stdout);
}else if(command === "publish"){
    packAndDeploy(option);
}

function packAndDeploy(path){

    var npmPackage = require(process.cwd()+"/package");
    var packname = npmPackage.name+"-"+npmPackage.version+".tgz";

    AWS.config.update(config);
    s3 =  new AWS.S3();

    npm.load(path, function(err){
        npm.commands.pack(path, function(err){
            console.log("Uploading Package to S3")
            var opts = {ACL: config.acl,
                        Body: fs.readFileSync(packname),
                        Bucket: config.bucket,
                        Key: "package/"+(packname).substr(0, packname.length-4)+"-"+hash+".tgz"}
            s3.putObject(opts, function(err, resp){
                if(err) throw err;
                console.log("It's Available here:", "https://"+opts.Bucket+".s3.amazonaws.com/"+opts.Key);
                fs.unlinkSync(packname);
            });
        });
    });
}


function promptForConfig(){

    process.stdout.write("Let setup your config!  It will be saved at ~/.npm-internalrc \n");

    function getInput(text, cb){
        process.stdout.write(text);        
        process.stdin.once("data", function(d){
            cb(null, d.toString().replace("\n", ""));
        });
    }

    var config = {};

    (function load(results, callback) {
        if (!results.accessKeyId) return getInput("AWS Key: ", function(err, input) {
            if (err) return callback(err);
            results.accessKeyId = input;
            load(results, callback);
        });
        if (!results.secretAccessKey) return getInput('AWS Secret: ', function(err, input) {
            if (err) return callback(err);
            results.secretAccessKey = input;
            load(results, callback);
        });
        if (!results.bucket) return getInput('S3 Bucket: ', function(err, input) {
            if (err) return callback(err);
            results.bucket = input;
            load(results, callback);
        });

        callback(null, results);
    })({}, function(err, config) {
        fs.writeFileSync(process.env.HOME+"/.npm-internalrc", JSON.stringify(config));
        process.exit(0);
    });


}
