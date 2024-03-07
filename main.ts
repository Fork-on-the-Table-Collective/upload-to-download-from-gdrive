import * as actions from "@actions/core";
import { google, drive_v3 } from "googleapis";
import * as fs from "fs";
import * as glob from "glob";
import archiver from "archiver";
import * as params from "./src/params.json"
/**
 * SetParams
 */
const setParams = () => {
  params["driveLinkToFolderBase"]="https://drive.google.com/drive/folders/"
  for (const input in params.inputs) {
    params.inputs[input].default = actions.getInput(input, {
      required: params.inputs[input]["required"],
    });
  }
  return params;
};

const isDirectory = (path: string): boolean => {
  try {
    return fs.lstatSync(path).isDirectory();
  } catch (error) {
    // If the path does not exist, an error will be thrown
    actions.error(`Path does not exist: ${path}`);
    throw error;
  }
};

/**
 * Creates a Google Drive API instance
 * @param {string} credentials Google Service Account credentials  encoded in base64
 */
const setUpDrive = (credentials: string): drive_v3.Drive => {
  const credentialsJSON = JSON.parse(
    Buffer.from(credentials, "base64").toString()
  );
  const scopes: string[] = ["https://www.googleapis.com/auth/drive"];
  const auth = new google.auth.JWT(
    credentialsJSON.client_email,
    undefined,
    credentialsJSON.private_key,
    scopes
  );
  return google.drive({ version: "v3", auth });
};

/**
 * Zips files by a glob pattern and stores it in memory
 * @param {string} glob Glob pattern to be matched
 * @param {string} out Name of the resulting zipped file
 */
const zipItemsByGlob = (glob: string, out: string) => {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = fs.createWriteStream(out);

  return new Promise<void>((resolve, reject) => {
    archive
      .glob(glob)
      .on("error", (err: Error) => reject(err))
      .pipe(stream);

    stream.on("close", () => {
      actions.info(
        `Files successfully zipped: ${archive.pointer()} total bytes written`
      );
      return resolve();
    });

    archive.finalize();
  });
};

/**
 * Uploads the file to Google Drive
 * @param {drive_v3.Drive} drive
 * @param {string} name upload name of the file
 * @param {string} path local path to the file to upload
 */
const uploadToDrive = async (
  drive: drive_v3.Drive,
  name: string,
  path: string,
  params
) => {
  actions.info("Creating file list from Google Drive folder...");
  const existingFiles: drive_v3.Schema$File[] = await listFilesInFolder(
    drive,
    params.inputs.googleFolderId.default
  );
  actions.info("List of existing files:")
  actions.info(JSON.stringify(existingFiles))
  actions.info("Uploading file to Google Drive...");
  drive.files
    .create({
      requestBody: {
        name,
        parents: [params.inputs.googleFolderId.default],
      },
      media: {
        body: fs.createReadStream(path),
      },
    })
    .then(async (res: any) => {
      actions.setOutput(
        params.outputs.link.value,
        `https://drive.google.com/file/d/${res.data.id}/view?usp=sharing`
      );
      if (params.inputs.emptyUploadFolder.default==="true") {
        existingFiles.forEach(async (file) => {
          if (file.name.includes(params.inputs.filterForDelete.default)) {
            await deleteItem(drive, file.id);
          }
        });
      }
      actions.setOutput(params.outputs.refId.value, res.data.id);
      actions.info("File uploaded successfully");
      const listOfFilesAfterUpload: drive_v3.Schema$File[] = await listFilesInFolder(
        drive,
        params.inputs.googleFolderId.default
      );
      actions.info("List of files after upload:")
      actions.info(JSON.stringify(listOfFilesAfterUpload))
    })
    .catch((e: Error) => {
      actions.error("Upload failed");
      throw e;
    });
};
/**
 * Download a file from Google Drive
 * @param {drive_v3.Drive} drive
 * @param {string} fileId Id of the file
 * @param {string} filePath Path for the downloaded file
 */
const downloadFromDrive = async (
  drive: drive_v3.Drive,
  fileId: string,
  filePath: string
) => {
  const dest = fs.createWriteStream(filePath);
  try {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
    response.data
      .on("error", (err: Error) => {
        actions.error(`Error downloading file: ${err}`);
        throw err;
      })
      .pipe(dest);
    return new Promise<void>((resolve, reject) => {
      dest.on("finish", () => {
        actions.info("File downloaded successfully");
        resolve();
      });
      dest.on("error", (err: Error) => {
        actions.error(`Error saving file: ${err}`);
        fs.unlinkSync(filePath); // Delete the partially downloaded file
        reject(err);
      });
    });
  } catch (err) {
    actions.error(`Error fetching file: ${err}`);
    throw err;
  }
};
/**
 * Download a file from Google Drive
 * @param {drive_v3.Drive} drive
 * @param {string} folderId Id of the google folder
 */
const listFilesInFolder = async (drive: drive_v3.Drive, folderId: string) => {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: "files(name, id)",
    });

    const files = response.data.files;
    if (files?.length) {

      return files;
    } else {
      return [] as drive_v3.Schema$File[];
    }
  } catch (error) {
    actions.error(`Error listing file: ${error}`);
    throw error;
  }
};

/**
 * Download a file from Google Drive
 * @param {drive_v3.Drive} drive
 * @param {string} folderId Id of the google folder
 */
const deleteItem = async (drive: drive_v3.Drive, fileId: string) => {
  try {
    await drive.files.delete({
      fileId: fileId,
    });
    actions.info(`File (${fileId}) deleted successfully.`);
  } catch (error) {
    actions.error(`Error deleting file: ${error}`);
    throw error;
  }
};

const main = async () => {
  const params = setParams();
  const drive = setUpDrive(params.inputs.credentials.default);
  if (params.inputs.actionType.default === "upload") {
    actions.setOutput(
      params.outputs.link.value,
      params["driveLinkToFolderBase"] + params.inputs.googleFolderId.default
    );
    const targets: string[] = glob.sync(params.inputs.localPath.default);
    if (targets.length === 1 && !isDirectory(targets[0])) {
      const filename: string = targets[0].split("/").pop() as string;
      await uploadToDrive(drive, filename, targets[0], params);
    } else {
      actions.info(
        `Multiple items or folder detected for glob ${params.inputs.localPath.default}`
      );
      actions.info("Zipping items...");

      const filename = `${params.inputs.zipName.default}.zip`;

      zipItemsByGlob(params.inputs.localPath.default, filename)
        .then(async () => {
          await uploadToDrive(drive, filename, filename, params);
        })
        .catch((e: Error) => {
          actions.error(`Zip failed. ${e}`);
          throw e;
        });
    }
  } else if (params.inputs.actionType.default === "download") {
    await downloadFromDrive(
      drive,
      params.inputs.googleFileId.default,
      params.inputs.localPath.default
    );
  } else if (params.inputs.actionType.default === "list") {
    const files = await listFilesInFolder(
      drive,
      params.inputs.googleFolderId.default
    );
    actions.setOutput(params.outputs.folderFiles.value, JSON.stringify(files));
  } else if (params.inputs.actionType.default === "delete") {
    await deleteItem(drive, params.inputs.googleFileId.default);
  }
};

main().catch((e: Error) => actions.setFailed(e));
