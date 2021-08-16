const actions = require('@actions/core');
const { google } = require('googleapis');
const fs = require('fs');
const glob = require('glob');
const archiver = require('archiver');

/** Google Service Account credentials  encoded in base64 */
const credentials = actions.getInput('credentials', { required: true });
/** Google Drive Folder ID to upload the file/folder to */
const folder = actions.getInput('folder', { required: true });
/** Glob pattern for the file(s) to upload */
const target = actions.getInput('target', { required: true });
/** Optional name for the zipped file */
const name = actions.getInput('name', { required: false });
/** Link to the Drive folder */
const link = 'link';
/* Link to file inside of folder */
const fileLink = 'fileLink';

const credentialsJSON = JSON.parse(Buffer.from(credentials, 'base64').toString());
const scopes = ['https://www.googleapis.com/auth/drive'];
const auth = new google.auth.JWT(credentialsJSON.client_email, null, credentialsJSON.private_key, scopes);
const drive = google.drive({ version: 'v3', auth });

const driveLink = `https://drive.google.com/drive/folders/${folder}`

async function main() {
  actions.setOutput(link, driveLink);

  const targets = glob.sync(target);

  if (targets.length === 1) {
    const filename = targets[0].split('/').pop();
    uploadToDrive(filename, targets[0]);
  } else {
    actions.info(`Multiple items detected for glob ${target}`);
    actions.info('Zipping items...');

    const filename = `${name}.zip`;

    zipItemsByGlob(target, filename)
      .then(() => {
        uploadToDrive(name, filename);
      })
      .catch(e => {
        actions.error('Zip failed');
        throw e;
      });
  }
}

/**
 * Zips files by a glob pattern and stores it in memory
 * @param {string} glob Glob pattern to be matched
 * @param {string} out Name of the resulting zipped file
 */
function zipItemsByGlob(glob, out) {
  const archive = archiver('zip', {zlib: {level: 9}});
  const stream = fs.createWriteStream(out);

  return new Promise((resolve, reject) => {
    archive
      .glob(glob)
      .on('error', err => reject(err))
      .pipe(stream);

    stream.on('close', () => {
      actions.info(`Files successfully zipped: ${archive.pointer()} total bytes written`);
      return resolve();
    });

    archive.finalize();
  });
}

/**
 * Uploads the file to Google Drive
 */
function uploadToDrive(name, path) {
  actions.info('Uploading file to Goole Drive...');
  drive.files.create({
    requestBody: {
      name,
      parents: [folder]
    },
    media: {
      body: fs.createReadStream(path)
    }
  })
  .then(res => {
    actions.setOutput(fileLink, `https://drive.google.com/file/d/${res.data.id}/view?usp=sharing`)
    actions.info('File uploaded successfully')
  })
  .catch(e => {
    actions.error('Upload failed');
    throw e;
  });
}

main().catch(e => actions.setFailed(e));
