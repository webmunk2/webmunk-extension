# Create Webmunk Extension

## Installation
`npm i --g create-webmunk-ext`

## Creating a new extension
`create-webmunk-ext myext`

will create a directory myext, intialize a git repo and create a complete file arborescence.
By default, the webpack build template will be used, meaning that you'll get a few webpack configuration files to build your new extension.

## Adding Webmunk modules to your extension
You'll need to install each of the modules you want to reuse in your extension:
`npm install @webmunk/${extension_module}`
And in the src

## Generating your extension in the webpack template case.
`npm run addon:dev:hot`