declare var global: any;
declare var OAuth2: any;
declare var process: any;

global.build = () => {
  // List sheet names
  const sheets = SpreadsheetApp.openById(process.env.DRIVE_FILE_ID).getSheets();
  const sheetNames = sheets.map(sheet => sheet.getName());
  Logger.log(sheetNames);

  // Export sheet HTML
  DriveApp.getStorageUsed();
  const blob = exportSheetAsZippedHTML(process.env.DRIVE_FILE_ID);
  const blobs = Utilities.unzip((blob as unknown) as GoogleAppsScript.Base.BlobSource);

  // Insert sheet tab into sheets
  const newBlobs = blobs.map(insertSheetTab(sheetNames));

  // Deploy
  deploy(newBlobs);
};

const exportSheetAsZippedHTML = fileId =>
  UrlFetchApp.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fzip`, {
    method: "get",
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` }
  }).getBlob();

const insertSheetTab = sheetNames => blob => {
  if (blob.getName() === "resources/sheet.css") {
    return blob;
  }

  const html =
    '<div id="docs-editor">' +
    '<div id="waffle-grid-container" style="box-sizing: border-box; height: 100%; padding-bottom: 40px;">' +
    // Sheet HTML
    blob.getDataAsString() +
    "</div>" +
    // Create sheet tab HTML
    '<style>.docs-sheet-tab{height: 100%;padding: 8px 16px 0;}</style><table id="grid-bottom-bar" style="position: fixed; bottom: 0px; z-index: 1000;" class="grid-bottom-bar " cellspacing="0" cellpadding="0" dir="ltr" role="presentation"><tbody><tr><td style="width:120px;">&nbsp;</td><td class="docs-sheet-outer-container"><div class="goog-inline-block"><div class="docs-sheet-container goog-inline-block" style="height: 39px;"><div class="docs-sheet-container-bar goog-toolbar goog-inline-block" role="toolbar" style="user-select: none;">' +
    sheetNames.reduce((content, sheetName) => {
      const active = blob.getName().replace(".html", "") === sheetName ? " docs-sheet-active-tab" : "";
      return (
        content +
        '<a href="' +
        sheetName +
        '.html" class="goog-inline-block docs-sheet-tab docs-material' +
        active +
        '" role="button" aria-expanded="false" tabindex="0" aria-haspopup="true" id=":6qd"><div class="goog-inline-block docs-sheet-tab-outer-box"><div class="goog-inline-block docs-sheet-tab-inner-box"><div class="goog-inline-block docs-sheet-tab-caption"><span dir="ltr" class="docs-sheet-tab-name" spellcheck="false">' +
        sheetName +
        "</span></div></div></div></a>"
      );
    }, "") +
    "</div></div></div></td></tr></tbody></table>" +
    "</div>";

  blob.setDataFromString(html);

  return blob;
};

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
  Logger.log("Version was created.");
  Logger.log(version);

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
  Logger.log("Files were populated.");
  Logger.log(uploadInfo);

  uploadInfo.uploadRequiredHashes.forEach(uploadRequiredHash => {
    const fileInfo = fileInfos.filter(fileInfo => fileInfo.hash === uploadRequiredHash)[0];

    UrlFetchApp.fetch(`${uploadInfo.uploadUrl}/${uploadRequiredHash}`, {
      method: "post",
      headers: { Authorization: `Bearer ${accessToken}` },
      contentType: "application/octet-stream",
      payload: fileInfo.gzipBlob.getBytes()
    });
    Logger.log(`${fileInfo.blobName} was uploaded.`);
  });

  const finalizedVersion = JSON.parse(
    UrlFetchApp.fetch(`https://firebasehosting.googleapis.com/v1beta1/${version.name}?update_mask=status`, {
      method: "patch",
      headers: { Authorization: `Bearer ${accessToken}` },
      contentType: "application/json",
      payload: JSON.stringify({ status: "FINALIZED" })
    }).getContentText()
  );
  Logger.log("Version was finalized.");
  Logger.log(finalizedVersion);

  const release = JSON.parse(
    UrlFetchApp.fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${firebaseKey.project_id}/releases?versionName=${version.name}`, {
      method: "post",
      headers: { Authorization: `Bearer ${accessToken}` }
    }).getContentText()
  );
  Logger.log("Release was created.");
  Logger.log(release);
};
