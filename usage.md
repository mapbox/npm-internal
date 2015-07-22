npm-internal needs to be configured.

Expects the following Env vars:

```bash
  NPMInternalBucket=<s3bucket>
  AWS_ACCESS_KEY_ID=<key>
  AWS_SECRET_ACCESS_KEY=<secret>
```

Optional:

  `NPMInternalAcl=public-read`  # set object acl on s3

Usage:

`npm-internal publish`

 This builds a npm package, and uploads it to your s3 bucket.


`npm-internal publish --dev`

This builds a npm package, and uploads it to your s3 bucket. But names it using git descibe, for dev releases

`npm-internal show <package name>`

Lists the versions of package available in the s3 bucket. If packname is omited it uses the current directory if possible.
