# GAS SiteGen

An example generating static sites from Google Sheets and deploying them to Firebase Hosting in Google Apps Script

## Requirements
- [Node.js](https://nodejs.org/)
- [google/clasp](https://github.com/google/clasp)

## Usage
```sh
$ echo '{ "scriptId": "<your_script_id>", "rootDir": "dist" }' > .clasp.json
$ export DRIVE_FILE_ID=<your-file-id>
$ export FIREBASE_KEY=`cat <<EOF
{
  "type": "service_account",
  "project_id": "<your-project-id>",
  "private_key_id": "<your-key-id>",
  "private_key": "-----BEGIN PRIVATE KEY-----\n<your-private-key>\n-----END PRIVATE KEY-----\n",
  "client_email": "<your-service-account-email>",
  "client_id": "<your-client-id>",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/[SERVICE-ACCOUNT-EMAIL]"
}
EOF
`

$ npm i
$ npm run deploy
```
