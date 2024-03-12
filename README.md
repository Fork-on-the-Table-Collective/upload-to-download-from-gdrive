# Upload to Google Drive/Download from Google Drive/Delete from Google Drive/List files in Google Drive
This action allows you to interact with files and folders in Google Drive.

## Table of Contents
- [Changes](#changes)
- [Setup](#setup)
    - [Google Service Account (GSA)](#google-service-account-gsa)
    - [Share Drive folder with the GSA](#share-drive-folder-with-the-gsa)
    - [Store credentials as GitHub secrets](#store-credentials-as-github-secrets)
- [Inputs](#inputs)
    - [`credentials`](#credentials)
    - [`actionType`](#actionType)
    - [`localPath`](#localPath)
    - [`googleFolderId`](#googleFolderId)
    - [`googleFileId`](#googleFileId)
    - [`zipName`](#zipName)
    - [`emptyUploadFolder`](#emptyUploadFolder)
    - [`filterForDelete`](#filterForDelete)
- [Outputs](#outputs)
    - [`link`](#link)
    - [`refId`](#refId)
    - [`refName`](#refName)
    - [`fileLink`](#fileLink)
    - [`folderFiles`](#folderFiles)
- [Usage Examples](#usage-examples)
    - [Upload file example](#upload-file-example)
    - [Download file example](#download-file-example)
    - [Delete file example](#delete-file-example)
    - [List files in folder example](#list-files-in-folder-example)
- [Documentation](#documentation)

## Setup
This section lists the requirements to make this action work and how to meet them.

### Google Service Account (GSA)
First of all, you will need a **Google Service Account** for your project. Service accounts are specific Google account types used by services instead of people. To create one, go to [*Service Accounts*](https://console.cloud.google.com/apis/credentials) in the *IAM and administration* section of the **Google Cloud Platform** dashboard. Create a new project or choose an existing one. Click on create new service account and continue with the process. At the end, you will get the option to generate a key. **Store this key safely**. It's a JSON file with the following structure:
```json
{
  "type": "",
  "project_id": "",
  "private_key_id": "",
  "private_key": "",
  "client_email": "",
  "client_id": "",
  "auth_uri": "",
  "token_uri": "",
  "auth_provider_x509_cert_url": "",
  "client_x509_cert_url": ""
}
```

### Share Drive folder with the GSA
Go to your **Google Drive** and find the folder you want your files to be uploaded to and share it with the GSA. You can find your service account email address in the `client_email` property of your GSA credentials. While you are here, take note of **the folder's ID**, the long set of characters after the last `/` in your address bar if you have the folder opened in your browser.

### Store credentials as GitHub secrets
This action needs your GSA credentials to properly authenticate with Google, and we don't want anybody to take a peek at them, right? Go to the **Secrets** section of your repo and add a new secret for your credentials. As per GitHub's recommendation, we will store any complex data (like your fancy JSON credentials) as a base64 encoded string. Encode your `.json` file easily into a new `.txt` file using any bash terminal (just don't forget to change the placeholders with the real name of your credentials file and and the desired output):
```bash
$ base64 CREDENTIALS_FILENAME.json > ENCODED_CREDENTIALS_FILENAME.txt
```
The contents of the newly generated `.txt` file are what we have to procure as a value for our secret.

>![](https://via.placeholder.com/15/f03c15/000000?text=+) **IMPORTANT**: This action assumes that the credentials are stored as a base64 encoded string. If that's not the case, the action will **fail**.

## Inputs
This section lists all inputs this action can take.

### `credentials`
Required: **YES**
A base64 encoded string with your GSA credentials.

### `actionType`
Required: **YES**
Type of action. Options are: upload, download, list, delete.

### `localPath`
Required: **NO**
Local path to the file/folder to upload or to the file path to download.

### `googleFolderId`
Required: **NO**
Google Drive folder ID to upload a file or list content.

### `googleFileId`
Required: **NO**
Google Drive file ID to download a file or delete it.

### `zipName`
Required: **NO**
Optional name for the zipped file.

### `emptyUploadFolder`
Required: **NO**
Set to true if you want to delete all files from the upload folder.

### `filterForDelete`
Required: **NO**
If `emptyUploadFolder` is set to true, then only those files will be deleted which contain this given string.

## Outputs
This section lists all outputs this action produces.

### `link`
A link to the Drive folder.

### `refId`
Id of the uploaded file.

### `refName`
Name of the uploaded file.

### `fileLink`
A direct link to the uploaded file.

### `folderFiles`
List of file names and IDs from the folder.

## Usage Examples
This section contains some useful examples.

### Upload file example
This workflow uploads a file to a Google Drive folder.
```yaml
name: Upload to Drive
on:
  push:
    branches:
      - master
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v2
      - name: Upload file to Google Drive
        uses: <YOUR-GITHUB-USERNAME>/upload-to-drive@master
        with:
          credentials: ${{ secrets.GSA_CREDENTIALS }}
          actionType: upload
          localPath: ./example.txt
          googleFolderId: <YOUR-DRIVE-FOLDER-ID>
```

### Download file example
This workflow downloads a file from Google Drive.
```yaml
name: Download from Drive
on:
  push:
    branches:
      - master
jobs:
  download:
    runs-on: ubuntu-latest
    steps:
      - name: Download file from Google Drive
        uses: <YOUR-GITHUB-USERNAME>/upload-to-drive@master
        with:
          credentials: ${{ secrets.GSA_CREDENTIALS }}
          actionType: download
          localPath: ./example.txt
          googleFileId: <YOUR-DRIVE-FILE-ID>
```

### Delete file example
This workflow deletes a file from Google Drive.
```yaml
name: Delete from Drive
on:
  push:
    branches:
      - master
jobs:
  delete:
    runs-on: ubuntu-latest


    steps:
      - name: Delete file from Google Drive
        uses: <YOUR-GITHUB-USERNAME>/upload-to-drive@master
        with:
          credentials: ${{ secrets.GSA_CREDENTIALS }}
          actionType: delete
          googleFileId: <YOUR-DRIVE-FILE-ID>
```

### List files in folder example
This workflow lists files in a Google Drive folder.
```yaml
name: List files in Drive
on:
  push:
    branches:
      - master
jobs:
  list:
    runs-on: ubuntu-latest
    steps:
      - name: List files in Google Drive folder
        uses: <YOUR-GITHUB-USERNAME>/upload-to-drive@master
        id: list
        with:
          credentials: ${{ secrets.GSA_CREDENTIALS }}
          actionType: list
          googleFolderId: <YOUR-DRIVE-FOLDER-ID>
      - name: Print folder files
        run: echo "${{ steps.list.outputs.folderFiles }}"
