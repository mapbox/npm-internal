#!/usr/bin/env node
var npm  = require('npm');
var AWS = require('aws-sdk');
var fs = require('fs');
var crypto = require('crypto');
var argv = require('minimist')(process.argv.splice(2));


var packAndDeploy = module.exports.packAndDeploy = function(s3, bucket, path, callback){
    var shasum = crypto.createHash('sha1');
    shasum.update((+(new Date()))+Math.random()+'');
    var hash = shasum.digest('hex');
    var npmPackage = require(((path !== "") ? path : process.cwd()) + '/package');

    if(argv.dev) {
        gitDescribe(checkS3)
    } else {
        checkS3(null)
    }

    function checkS3(err, describe) {

        if (err) return callback(err);
        var packname = npmPackage.name+'-'+npmPackage.version+'.tgz';
        // iterate through packages, looking for any that exist w/ same name & version
        s3.listObjects({Bucket: bucket, Prefix: 'package/' + npmPackage.name}, function(err, data) {
            if(err) callback(err);

            var conflict = data.Contents.some(function(bucketEntry) {
                var bucketEntryMinusGitSha = bucketEntry.Key.split('-');
                bucketEntryMinusGitSha.pop();
                bucketEntryMinusGitSha = bucketEntryMinusGitSha.join('-');
                return (bucketEntryMinusGitSha === 'package/' + npmPackage.name + '-' + (describe || npmPackage.version));
            });

            // conflicting name, error out w/ some friendly advice
            if (conflict) {
                console.error(npmPackage.name + '-' + npmPackage.version + ' already exists.\n');
                console.error('Please increment the version number in package.json to remove the conflict and try again.\n');
                console.error('Or for a dev package use --dev \n');
                callback(null, false);
            } else { // roll package and upload to S3; emit package URL
                npm.load(npmPackage, function(err){
                    if(err) callback(err);
                    if (path === "") path = process.cwd();
                    npm.commands.pack([path], function(err){
                        if(err) callback(err);
                        console.log('Uploading Package to S3');
                        var opts = {ACL: process.env.NPMInternalAcl || 'public-read',
                                    Body: fs.createReadStream(packname),
                                    Bucket: bucket,
                                    Key: 'package/' + npmPackage.name + '-' + (describe || npmPackage.version) + '-' + hash + '.tgz'}
                        s3.putObject(opts, function(err, resp){
                            if(err) callback(err);
                            console.log('package url: https://' + opts.Bucket + '.s3.amazonaws.com/' + opts.Key);
                            fs.unlinkSync(packname);
                            callback(null, true);
                         });
                    });
                });
            }
        });
    }
};

var showPackage = module.exports.packAndDeploy = function(s3, bucket, packageName, callback){

    s3.listObjects({Bucket: bucket, Prefix: 'package/' + packageName}, function(err, data) {
        if (err) callback(err);
        var conflict = data.Contents.forEach(function(bucketEntry) {
            var bucketEntryMinusGitSha = bucketEntry.Key.split('-');
            bucketEntryMinusGitSha.pop();
            var version = bucketEntryMinusGitSha.pop();
            var bucketPackageName = bucketEntryMinusGitSha.join('-');
            if(bucketPackageName === 'package/' + packageName) {
                console.log(version, 'https://' + bucket + '.s3.amazonaws.com/' + bucketEntry.Key)
            }
        });
    });
};

if (!module.parent) {
    if (!process.env.NPMInternalBucket || !argv._[0] ) {
        fs.createReadStream(__dirname + '/usage.md').pipe(process.stdout);
    } else if (argv._[0] === 'publish') {
        packAndDeploy(new AWS.S3(), process.env.NPMInternalBucket, argv._[1] || "", function(err, result) {
            if (err) throw err;
            process.exit(result ? 0 : 1);
        });
    } else if (argv._[0] === 'show') {
        showPackage(new AWS.S3(), process.env.NPMInternalBucket, argv._[1] || "", function(err, result) {
            if (err) throw err;
            process.exit(result ? 0 : 1);
        });
    } else {
        console.error('Unknown command');
        fs.createReadStream(__dirname + '/usage.md').pipe(process.stdout);
    }
}

function gitDescribe(callback){
    var spawn = require('child_process').spawn,
    gd    = spawn('git', ['describe']);
    var description = '';
    gd.stdout.on('data', function (data) {
        description += data;
    });
    var error = '';
    gd.stderr.on('data', function (data) {
        error += data;
    });

    gd.on('close', function (code) {
        if(code !== 0) callback(new Error('Error running git describe'));
        callback(null, description.replace('\n', ''));
    });
}
