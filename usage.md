npm-internal needs to be configured.

Expects the following Env vars:

```bash
  NPMInternalBucket=<s3bucket>
  AWS_ACCESS_KEY_ID=<key>
  AWS_SECRET_ACCESS_KEY=<secret>
```

The AWS authentication variables can also be set up using [mapbox-cli](https://github.com/mapbox/mapbox-cli).

Optional:

  `NPMInternalAcl=public-read`  # set object acl on s3

Usage:

`npm-internal publish`

  This builds a npm package, and uploads it to your s3 bucket.
