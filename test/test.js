var tape = require('tape'),
    npmi = require('../index.js'),
    async = require('async'),
    fakeAWS = require('mock-aws-s3'),
    bucket = __dirname + '/local';

function deleteTestPackage(s3, packageName, callback) {        
    var packagePrefix = packageName.split('-');
    packagePrefix.pop();
    packagePrefix = packagePrefix.join('-');

    var to_delete = {
        Bucket: bucket,
        Delete: {
            Objects: []
        }
    };

    s3.listObjects({Bucket: bucket, Prefix: 'package/' + packagePrefix}, function(err, data) {        
        data.Contents.forEach(function(bucketEntry) {
            if (bucketEntry.Key.indexOf('package/' + packageName) > -1) {                
                to_delete.Delete.Objects.push({ Key: bucketEntry.Key});
            }
        });
        
        s3.deleteObjects(to_delete, callback);
    });
}

tape('prefix collision test', function(t) {
    t.plan(3);
    var s3 = new fakeAWS.S3();
    var tasks = [];
    tasks.push(function(cb) {
        deleteTestPackage(s3, 'npm-internal-prefix-test', cb);
    });
    tasks.push(function(cb) {
        deleteTestPackage(s3, 'npm-internal-prefix-test-2', cb);
    });
    tasks.push(function(cb) {
        npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-prefix-test-2', function(err, result) {            
            t.ok((!err && result), 'Uploaded prefix collision package 1 (e.g. maps-1.0.0)');
            cb();
        });
    });
    tasks.push(function(cb) {
        npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-prefix-test', function(err, result) {
            t.ok((!err && result), 'Uploaded prefix collision package 2 (e.g. maps-1.0.0-dev) without conflict');
            cb();
        });
    });
    tasks.push(function(cb) {
        deleteTestPackage(s3, 'npm-internal-prefix-test', cb);
    });
    tasks.push(function(cb) {
        deleteTestPackage(s3, 'npm-internal-prefix-test-2', cb);
    });

    async.series(tasks, function() {
        t.pass('Completed housekeeping.');
    });
});

tape('collision test', function(t) {
    t.plan(3);

    var s3 = new fakeAWS.S3();

    // ensure a clean slate, then test
    deleteTestPackage(s3, 'npm-internal-collision-test-1.0.0', function() {
        async.series([
            function(cb) {
                // pass the first time
                npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-collision-test',
                    function(err, result) { 
                        t.ok((!err && result), 'Uploaded test package successfully to a clean slate'); 
                        cb();
                    });
            },
            
            function(cb) {
                // fail the second
                npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-collision-test',
                    function(err, result) { 
                        t.ok((!err && !result), 'Correctly failed to upload when existing package is present'); 
                        cb();
                    });
            },


        ], function() {
            // clean up after ourselves
            deleteTestPackage(s3, 'npm-internal-collision-test-1.0.0', function() { t.pass('Cleaned up after ourselves'); });
        });        
    });
});