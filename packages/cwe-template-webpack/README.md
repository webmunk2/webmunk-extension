# The webpack build template

This template is the default template used by the create-webmunk-ext script to create an initial tree structure.
As the name indicates, this template aims at engineers eager to use webpack for building their extension.
The tree structure includes the following set of files/directories:
```
├───📁 assets/
│   └───...
├───📁 deliveries/ (where production builds end-up, ie zip files that can be uploaded in CWS)
│   └───...
├───📁 images/
│    └───...
├───📁 dist/ (where webpack generates the bundled scripts)
│   └───...
├───📁 src/ (where you include all your scripts ie worker, content, etc ...)
│   └───...
├───📄 webpack.addon.config.base.js
├───📄 webpack.addon.config.dev.js
├───📄 webpack.addon.chrome.config.prod.js
└───📄 webpack.addon.chrome.config.prod.zip.js
```

Regarding the src folder, 5 sub-folders are included with the appropriate ts files:
```
├───📁 worker/
│   ├───📄 index.ts
│   └───📄 Worker.ts
├───📁 chrome/
│   └───📄 baseManifest.json
├───📁 content/
│   └───📄 index.js
├───📁 options/
│   └───📄 options.js
└───📁 pages/
    └───...
```

Those are the files used by the webpack build process to generate the corresponding extension scripts. This is where the developer will import the webmunk extension modules files.
- chrome/baseManifest.json  is a manifest to be modified by the developer and includes new elements related to the final extension itself. The manifest.json "real" file will be built from this file and the manifest files of the webmunk extension modules.

The template brings a few webpack configs which are used to build the extension.
- webpack.addon.config.base is the config used by all other webpack configs and include the targets, the assets to copy.
- webpack.addon.config.dev is the config to buid a development version for usage in unpackaged mode. It customizes the base webpack config.
- webpack.addon.chrome.config.prod is the config to build a production version.
- webpack.addon.config.prod.zip is the config to build a production version. End-product is the zip extension file.

## Available Scripts

In the project directory, you can run:

### `npm run addon:dev:hot`

Creates in /dist an unpackaged version of the extension in  development mode.

### `npm run addon:build:prod`

Creates in /dist an unpackaged version of the extension in  production mode.


### `npm run addon:build:prod-zip`

Creates in /builds a zipped version of the extension in production mode.
Zip file can be uploaded on Chrome Web store.

Note: those scripts will also display a consolidated list of justifications for the permissions required by the imported webmunk extension modules. This info aims at facilitating the registration of the extension in the CWS (Chrome Web Store).


## Importing a webmunk module
Refer to the README.md file of the webmunk extension module.