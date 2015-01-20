var tape = require('tape'),
    AWS = require('aws-sdk'),
    npmi = require('../index.js'),
    async = require('async');

function deleteTestPackage(s3, callback) {
    var bucket = process.env.NPMInternalBucket;
    var deletions = [];
    s3.listObjects({Bucket: bucket, Prefix: 'package/npm-internal-collision-test'}, function(err, data) {        
        data.Contents.forEach(function(bucketEntry) {
            if (bucketEntry.Key.indexOf('package/npm-internal-collision-test-1.0.0') > -1) {                
                deletions.push(function(cb){ s3.deleteObject({Bucket: bucket, Key: bucketEntry.Key}, cb) });
            }
        });
        async.series(deletions, callback);
    });
}

tape('collision test', function(t) {
    t.plan(3);

    var s3 = new AWS.S3();

    // ensure a clean slate, then test
    deleteTestPackage(s3, function() {
        async.series([
            function(cb) {
                // pass the first time
                npmi.packAndDeploy(process.cwd() + '/test/fixtures/npm-internal-collision-test', 
                    function(err, result) { 
                        t.ok((!err && result), 'Uploaded package successfully to a clean slate'); 
                        cb();
                    });
            },
            
            function(cb) {
                // fail the second
                npmi.packAndDeploy(process.cwd() + '/test/fixtures/npm-internal-collision-test', 
                    function(err, result) { 
                        t.ok((!err && !result), 'Failed to upload with existing package'); 
                        cb();
                    });
            },


        ], function() {
            // clean up after ourselves
            deleteTestPackage(s3, function() { t.pass('Cleaned up after ourselves'); });
        });        
    });
});