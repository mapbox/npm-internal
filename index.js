#!/usr/bin/env node
var npm  = require('npm');
var AWS = require('aws-sdk');
var fs = require('fs');
var crypto = require('crypto');
var exec = require('child_process').execSync;
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
    }
}

function packAndDeploy(s3, bucket, path, force, callback){
    var shasum = crypto.createHash('sha1');
    shasum.update((+(new Date()))+Math.random()+'');
    var hash = shasum.digest('hex');

    var npmPackage = require(((path !== "") ? path : process.cwd()) + '/package');
    var packname = npmPackage.name+'-'+npmPackage.version+'.tgz';

    // iterate through packages, looking for any that exist w/ same name & version
    s3.listObjects({Bucket: bucket, Prefix: 'package/' + npmPackage.name}, function(err, data) {

        if(err) callback(err);

        var conflict = data.Contents.some(function(bucketEntry) {
            var bucketEntryMinusGitSha = bucketEntry.Key.split('-');
            bucketEntryMinusGitSha.pop();
            bucketEntryMinusGitSha = bucketEntryMinusGitSha.join('-');
            return (bucketEntryMinusGitSha === 'package/' + npmPackage.name + '-' + npmPackage.version);
        });

        // conflicting name, error out w/ some friendly advice
        if (conflict) {
            process.stderr.write(npmPackage.name + '-' + npmPackage.version + ' already exists.\n');
            process.stderr.write('Please increment the version number in package.json to remove the conflict and try again.\n');
            return callback(null, false);
        }
        // roll package and upload to S3; emit package URL
        else {
            npm.load(npmPackage, function(err){
                if(err) callback(err);
                if (path === "") path = process.cwd();
                npm.commands.pack([path], function(err){

                    if(err) callback(err);

                    // if a git project, check for extra files
                    if (fs.existsSync(path+'/.git')) {
                        var non_git_files_present = [];
                        var pack_file_list = exec("tar tvf " + packname + " | awk '{print $" + (process.platform === 'darwin' ? '9' : '6' )+  "}'").toString().split("\n").map(function(x) { return (x.replace(/^package\//, '').trim()); });
                        var git_file_list = exec("git ls-files", {cwd: path}).toString().split("\n");
                        non_git_files_present = pack_file_list.reduce(function(out, pack_file) {
                            if ((git_file_list.indexOf(pack_file) === -1) && (pack_file !== packname))
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
                                Key: 'package/' + (packname).substr(0, packname.length-4) + '-' + hash + '.tgz'}
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

module.exports.packAndDeploy = packAndDeploy;
