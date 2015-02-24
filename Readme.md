npm-internal
------------

This helps you package internal npm modules and upload them to your own s3 bucket. Then you can include them in other projects using the url it returns.

```
> npm install -g npm-internal
```

Setup config.  npm-internal uses Env vars for all its config. See [usage.md](usage.md) for details.


# Go to base directory of your node module

```
> npm-internal publish

npm-package-0.0.0.tgz
Uploading Package to S3
package url: https://{BUCKET}.s3.amazonaws.com/package/npm-package-0.0.0-e84b5cf2ebc818b602885a9e0d7b351b8a9928d1.tgz
```
