declare var global: any;
declare var OAuth2: any;
declare var process: any;

global.build = () => {
  DriveApp.getStorageUsed();

  const blob = exportSheetAsZippedHTML(process.env.DRIVE_FILE_ID);

  const blobs = Utilities.unzip((blob as unknown) as GoogleAppsScript.Base.BlobSource);

  deploy(blobs);
};

const exportSheetAsZippedHTML = fileId =>
  UrlFetchApp.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fzip`, {
    method: "get",
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` }
  }).getBlob();

const firebaseKey = JSON.parse(process.env.FIREBASE_KEY);

const deploy = (blobs: GoogleAppsScript.Base.Blob[]) => {
  const accessToken = OAuth2.createService(`Firebase Hosting: ${firebaseKey.project_id}`)
    .setAuthorizationBaseUrl(firebaseKey.auth_uri)
    .setTokenUrl(firebaseKey.token_uri)
    .setPrivateKey(firebaseKey.private_key)
    .setIssuer(firebaseKey.client_email)
    .setPropertyStore(PropertiesService.getScriptProperties())
    .setScope("https://www.googleapis.com/auth/cloud-platform")
    .getAccessToken();

  const version = JSON.parse(
    UrlFetchApp.fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${firebaseKey.project_id}/versions`, {
      method: "post",
      headers: { Authorization: `Bearer ${accessToken}` }
    }).getContentText()
  );
  console.log("Version was created.", version);

  const fileInfos = blobs.map(blob => {
    const gzipBlob = Utilities.gzip((blob as unknown) as GoogleAppsScript.Base.BlobSource);
    const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, gzipBlob.getBytes())
      .map(dec => ("00" + (dec < 0 ? dec + 256 : dec).toString(16)).slice(-2))
      .join("");
    return {
      blobName: blob.getName(),
      gzipBlob,
      hash
    };
  });

  const files = fileInfos.reduce((files, fileInfo) => {
    files[`/${fileInfo.blobName}`] = fileInfo.hash;
    return files;
  }, {});

  const uploadInfo = JSON.parse(
    UrlFetchApp.fetch(`https://firebasehosting.googleapis.com/v1beta1/${version.name}:populateFiles`, {
      method: "post",
      headers: { Authorization: `Bearer ${accessToken}` },
      contentType: "application/json",
      payload: JSON.stringify({ files })
    }).getContentText()
  );
  console.log("Files were populated.", uploadInfo);

  uploadInfo.uploadRequiredHashes.forEach(uploadRequiredHash => {
    const fileInfo = fileInfos.filter(fileInfo => fileInfo.hash === uploadRequiredHash)[0];

    UrlFetchApp.fetch(`${uploadInfo.uploadUrl}/${uploadRequiredHash}`, {
      method: "post",
      headers: { Authorization: `Bearer ${accessToken}` },
      contentType: "application/octet-stream",
      payload: fileInfo.gzipBlob.getBytes()
    });
    console.log(`${fileInfo.blobName} was uploaded.`);
  });

  const finalizedVersion = JSON.parse(
    UrlFetchApp.fetch(`https://firebasehosting.googleapis.com/v1beta1/${version.name}?update_mask=status`, {
      method: "patch",
      headers: { Authorization: `Bearer ${accessToken}` },
      contentType: "application/json",
      payload: JSON.stringify({ status: "FINALIZED" })
    }).getContentText()
  );
  console.log("Version was finalized.", finalizedVersion);

  const release = JSON.parse(
    UrlFetchApp.fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${firebaseKey.project_id}/releases?versionName=${version.name}`, {
      method: "post",
      headers: { Authorization: `Bearer ${accessToken}` }
    }).getContentText()
  );
  console.log("Release was created.", release);
};
