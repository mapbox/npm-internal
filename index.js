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

    // iterate through packages, looking for any that exist w/ same name & version
    s3.listObjects({Bucket: process.env.NPMInternalBucket, Prefix: 'package/' + npmPackage.name}, function(err, data) {        
        var conflict = data.Contents.some(function(bucketEntry) {
            return (bucketEntry.Key.indexOf('package/' + npmPackage.name + '-' + npmPackage.version) > -1);
        });

        // conflicting name, error out w/ some friendly advice
        if (conflict) {
            process.stderr.write(npmPackage.name + '-' + npmPackage.version + ' already exists.\n');
            process.stderr.write('Please increment the version number in package.json to remove the conflict and try again.\n');
            process.exit(1);
        }
        // roll package and upload to S3; emit package URL
        else {
            npm.load(path, function(err){
                npm.commands.pack(path, function(err){    
                    console.log('Uploading Package to S3');
                    var opts = {ACL: process.env.NPMInternalAcl || 'public-read',
                                Body: fs.createReadStream(packname),
                                Bucket: process.env.NPMInternalBucket,
                                Key: 'package/' + (packname).substr(0, packname.length-4) + '-' + hash + '.tgz'}
                    s3.putObject(opts, function(err, resp){
                        if(err) throw err;
                        console.log('package url: https://' + opts.Bucket + '.s3.amazonaws.com/' + opts.Key);
                        fs.unlinkSync(packname);
                    });
                });
            });
        }
    });
}
