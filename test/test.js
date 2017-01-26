var tape = require('tape'),
    os = require('os'),
    fs = require('fs'),
    path = require('path'),
    queue = require('queue-async'),
    npmi = require('../index.js'),
    fakeAWS = require('mock-aws-s3'),
    rimraf = require('rimraf'),
    exec = require('sync-exec'),
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

        if (to_delete.Delete.Objects.length > 0)
            s3.deleteObjects(to_delete, callback);
        else
            callback();
    });
}

tape('Git exclusion', function(t) {
    var packname = 'npm-internal-git-exclusion-test';
    var s3 = new fakeAWS.S3();

    // create test node package
    var temp = os.tmpdir();
    exec('cp -r ' + __dirname + '/fixtures/' + packname + ' ' + temp);
    temp = path.normalize(temp + '/' + packname);

    var tasks = [
        function(cb) {
            npmi.packAndDeploy(s3, bucket, temp, false, function(err, result) {
                t.ok((!err && result), 'Uploaded when package is not a git repo');
                cb();
            });
        },
        function(cb) {
            exec('git init && git config user.email "testuser@mapbox.com" && git config user.name "Test User"', {cwd: temp});
            exec('git add ' + temp + '/file_a ' + temp + '/package.json ' + temp + '/index.js && git commit -m "first commit"', {cwd: temp});
            npmi.packAndDeploy(s3, bucket, temp, false, function(err, result) {
                t.ok((!err && !result), 'Refused to upload with file outside git inventory ' +  err + ' ' + result);
                cb();
            });
        },
        function(cb) {
            npmi.packAndDeploy(s3, bucket, temp, true, function(err, result) {
                t.ok((!err && result), 'Uploaded with file outside git inventory when --forced');
                cb();
            });
        },
        function(cb) {
            exec('git add file_b && git commit -m "second commit"', {cwd: temp});
            npmi.packAndDeploy(s3, bucket, temp, true, function(err, result) {
                t.ok((!err && result), 'Uploaded package when all files are checked into git');
                cb();
            });
        }
    ];

    var q = queue(1);
    tasks.forEach(function(task, i) {
        q.defer(function(dtpcb) { deleteTestPackage(s3, packname + '-1.0.0', dtpcb); });
        q.defer(task);
    });
    q.awaitAll(function(err, result) {
        // clean up
        rimraf(temp, function() { t.end() });
    });
});


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
        npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-prefix-test-2', false, function(err, result) {
            t.ok((!err && result), 'Uploaded prefix collision package 1 (e.g. maps-1.0.0)');
            cb();
        });
    });
    tasks.push(function(cb) {
        npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-prefix-test', false, function(err, result) {
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

    var q = queue(1);
    tasks.forEach(function(task) { q.defer(task); });
    q.awaitAll(function(err, result) {
        t.pass('Completed housekeeping.');
    });
});

tape('collision test', function(t) {
    t.plan(3);

    var s3 = new fakeAWS.S3();

    // ensure a clean slate, then test
    deleteTestPackage(s3, 'npm-internal-collision-test-1.0.0', function() {
        var tasks = [];

        tasks.push(function(cb) {
                // pass the first time
                npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-collision-test', false,
                    function(err, result) {
                        t.ok((!err && result), 'Uploaded test package successfully to a clean slate');
                        cb();
                    });
            });

        tasks.push(function(cb) {
                // fail the second
                npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-collision-test', false,
                    function(err, result) {
                        t.ok((!err && !result), 'Correctly failed to upload when existing package is present');
                        cb();
                    });
            });

        var q = queue(1);
        tasks.forEach(function(task) { q.defer(task); });
        q.awaitAll(function(err, result) {
            // clean up after ourselves
            deleteTestPackage(s3, 'npm-internal-collision-test-1.0.0', function() { t.pass('Cleaned up after ourselves'); });
        });
    });
});

tape('scoped package test', function(t) {
    t.plan(3);

    var s3 = new fakeAWS.S3();

    // ensure a clean slate, then test
    deleteTestPackage(s3, 'org-npm-internal-scoped-1.0.0', function() {
        var tasks = [];

        tasks.push(function(cb) {
                // pass the first time
                npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-scoped', false,
                    function(err, result) {
                        t.ok((!err && result), 'Uploaded test package successfully to a clean slate');
                        cb();
                    });
            });

        tasks.push(function(cb) {
                // fail the second
                npmi.packAndDeploy(s3, bucket, __dirname + '/fixtures/npm-internal-scoped', false,
                    function(err, result) {
                        t.ok((!err && !result), 'Correctly failed to upload when existing package is present');
                        cb();
                    });
            });

        var q = queue(1);
        tasks.forEach(function(task) { q.defer(task); });
        q.awaitAll(function(err, result) {
            // clean up after ourselves
            deleteTestPackage(s3, 'org-npm-internal-scoped-1.0.0', function() { t.pass('Cleaned up after ourselves'); });
        });
    });
});
