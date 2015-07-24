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

### dev releases

sometimes dev packages are useful for staging deploys

```
> npm-internal publish --dev

dev publish: npm-package-v0.0.0-2-g30bc1a6
npm-package-0.0.0.tgz
Uploading Package to S3
package url: https://{BUCKET}.s3.amazonaws.com/package/npm-package-v0.0.0-2-g30bc1a6-e84b5cf2ebc818b602885a9e0d7b351b8a9928d1.tgz
```

### show versions

need a link to a current or past version. npm-internal show

```
> npm-internal show

0.0.0 https://{BUCKET}.s3.amazonaws.com/package/npm-package-0.0.0-e84b5cf2ebc818b602885a9e0d7b351b8a9928d1.tgz
0.0.1 https://{BUCKET}.s3.amazonaws.com/package/npm-package-0.0.1-e84b5cf2ebc818b602885a9e0d7b351b8a9928d1.tgz
```
