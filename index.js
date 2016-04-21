#!/usr/bin/env node
var npm  = require('npm');
var AWS = require('aws-sdk');
var fs = require('fs');
var crypto = require('crypto');
var exec = require('sync-exec');
var argv = require('minimist')(process.argv.splice(2));

if (!module.parent) {
    if (!process.env.NPMInternalBucket || !argv._[0] ) {
        fs.createReadStream(__dirname + '/usage.md').pipe(process.stdout);
    }
    else if(argv._[0] === 'publish') {
        packAndDeploy(new AWS.S3(), process.env.NPMInternalBucket, argv._[1] || "", (argv.f || argv.force), function(err, result) {
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

function packAndDeploy(s3, bucket, path, force, callback){
    if (path === "") path = process.cwd();
    var shasum = crypto.createHash('sha1');
    shasum.update((+(new Date()))+Math.random()+'');
    var hash = shasum.digest('hex');
    var npmPackage = require(path + '/package');

    if (!npmPackage.name) {
        return callback(new Error('package.json must contain "name"'));
    }
    if (!npmPackage.version) {
        return callback(new Error('package.json must contain "version"'));
    }

    var packname = npmPackage.name+'-'+npmPackage.version+'.tgz';

    var describe = null;
    if(argv.dev) {
        if (fs.existsSync(path+'/.git')) {
            describe = exec("git describe --tags", {cwd: path}).stdout.replace('\n', '');
            describe = describe || 'v' + npmPackage.version + '-' + exec('git rev-parse HEAD', {cwd: path}).stdout.replace('\n', '');
            console.log('dev publish: '+ npmPackage.name+'-'+describe)
        } else {
            return callback(new Error('to use --dev this has to be a git repo'));
        }
    }

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
            console.error('');
            console.error(npmPackage.name + '-' + (describe || npmPackage.version) + ' already exists.');
            console.error('Please either increment the version number in package.json to remove the conflict and try again.');
            console.error('Or for a dev package use --dev');
            callback(null, false);
        } else { // roll package and upload to S3; emit package URL
            npm.load(npmPackage, function(err){
                if(err) callback(err);
                npm.commands.pack([path], function(err){

                    if(err) callback(err);

                    // if a git project, check for extra files
                    if (fs.existsSync(path+'/.git')) {
                        var non_git_files_present = [];
                        var pack_file_list = exec("tar tvf " + packname + " | awk '{print $" + (process.platform === 'darwin' ? '9' : '6' )+  "}'").stdout.split("\n").map(function(x) { return (x.replace(/^package\//, '').trim()); }).filter(function(e) { return e.length>0; });
                        var git_file_list = exec("git ls-files", {cwd: path}).stdout.split("\n").filter(function(e) { return e.length>0; });;

                        non_git_files_present = pack_file_list.reduce(function(out, pack_file) {
                            if ((git_file_list.indexOf(pack_file) === -1) && (pack_file !== packname) && (['.npmignore'].indexOf(pack_file)===-1))
                                out.push(pack_file);
                            return out;
                        }, []);

                        // if non-git files found, warn (unless override)
                        if ((non_git_files_present.length > 0) && !force) {
                            process.stderr.write('Aborting: the package contains the following files not tracked in Git.\n');
                            process.stderr.write('This is often a mistake. Use -f/--force to override this check.\n');
                            non_git_files_present.forEach(function(ngf) { console.log('  ' + ngf); });
                            return callback(null, false);
                        }
                    }

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

};

function showPackage(s3, bucket, packageName, callback) {
    if(fs.existsSync(process.cwd()+'/package.json')) {
        var name = require(process.cwd() + '/package').name;
    }
    if(!name && packageName.length === 0) {
        return callback(new Error('No package name provided and no package.json found'));
    }
    s3.listObjects({Bucket: bucket, Prefix: 'package/' + (packageName || name)}, function(err, data) {
        if (err) callback(err);
        if (data.Contents.length === 0) {
            console.log('No package found');
            return callback(null, true);
        }
        var conflict = data.Contents.forEach(function(bucketEntry) {
            var bucketEntryMinusGitSha = bucketEntry.Key.split('-');
            bucketEntryMinusGitSha.pop();
            var version = bucketEntryMinusGitSha.pop();
            var bucketPackageName = bucketEntryMinusGitSha.join('-');
            if(bucketPackageName === 'package/' + (packageName || name)) {
                console.log(version, 'https://' + bucket + '.s3.amazonaws.com/' + bucketEntry.Key)
            }
        });
    });
};
module.exports.packAndDeploy = packAndDeploy;
module.exports.showPackage = showPackage;
