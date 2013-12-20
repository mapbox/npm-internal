npm-internal
------------


This helps you package internal npm modules and upload them to your own s3 bucket. Then you can include them in other projects using the url it returns.

```
> npm install -g npm-internal


# Go to base directory of your node module

> npm-internal publish

npm-package-0.0.0.tgz
Uploading Package to S3
It's Available here: http://{BUCKET}.s3.amazonaws.com/package/npm-package-0.0.0-e84b5cf2ebc818b602885a9e0d7b351b8a9928d1.tgz

```

On first run it will prompt you to set some config options, like AWS key and secret as well as the bucket name.  You can also set this config by running `npm-internal config`



