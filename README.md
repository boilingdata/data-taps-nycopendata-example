[Collect(d)ion and FluentBit](https://github.com/boilingdata/data-taps-fluentbit-example) | [Web Analytics capture](https://github.com/boilingdata/data-taps-webanalytics-example) | [PostgreSQL CDC](https://github.com/boilingdata/data-taps-postgres-cdc) | [API ingestion](https://github.com/boilingdata/data-taps-nycopendata-example)

# NYC OpenData API ingestion to Data Tap Example

<p align="center">
  <img src="img/nycod-example.png" title="simple architecture">
</p>

This example illustrates how a scheduled AWS Lambda function can fetch new data since last fetch from an API ([NYC OpenData](https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5/data_preview)) and feed to Data Tap for optimal S3 ingestion and analytics.

> **NOTE** The code does not (yet) fetch the new results since last fetch, but the same results.

You need a Data Tap on your AWS Account. You can follow these instructions: https://github.com/boilingdata/data-taps-template/tree/main/aws_sam_template. Export the Tap URL as `BD_TAP_URL` environment variable.

```shell
export BD_TAP_URL=deployedDataTapUrl
export BD_USERNAME=yourBoilingUsername
export BD_PASSWORD=yourBoilingPassword
export NYCOD_USERNAME=NYCOpenDataAPIKeyId
export NYCOD_PASSWORD=NYCOpenDataSecretKey
export NYCOD_APPTOKEN=NYCOpenDataAppToken
# The envs will be given as parameters for the stack deployment
yarn build
yarn deploy
```
