#!/usr/bin/env node
var npm  = require('npm');
var AWS = require('aws-sdk');
var fs = require('fs');
var crypto = require('crypto');
var argv = require('minimist')(process.argv.splice(2));

if (!process.env.NPMInternalBucket || !argv._[0] ) {
    fs.createReadStream(__dirname + '/usage.md').pipe(process.stdout);
}else if(argv._[0] === 'publish') {
    packAndDeploy(argv._[1] || "");
}

function packAndDeploy(path){

    var shasum = crypto.createHash('sha1');
    shasum.update((+(new Date()))+Math.random()+'');
    var hash = shasum.digest('hex');

    var npmPackage = require(process.cwd()+'/package');
    var packname = npmPackage.name+'-'+npmPackage.version+'.tgz';

    var s3 =  new AWS.S3();

    npm.load(path, function(err){
        npm.commands.pack(path, function(err){
            console.log('Uploading Package to S3')
            var opts = {ACL: process.env.NPMInternalAcl || 'public-read',
                        Body: fs.readFileSync(packname),
                        Bucket: process.env.NPMInternalBucket,
                        Key: 'package/'+(packname).substr(0, packname.length-4)+'-'+hash+'.tgz'}
            s3.putObject(opts, function(err, resp){
                if(err) throw err;
                console.log('package url: https://'+opts.Bucket+'.s3.amazonaws.com/'+opts.Key);
                fs.unlinkSync(packname);
            });
        });
    });
}
