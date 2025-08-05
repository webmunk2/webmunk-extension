const searchModulesInDirectory = require("./depsFromModules").searchModulesInDirectory
const chalk = require('chalk');
const _ = require('lodash')
const util = require('util');
const fs = require('fs');
const path = require('path');

function log(o){
  console.log(util.inspect(o, { depth: null }));
}

function copyDirectorySync(sourceDir, destinationDir) {
  // Check if the source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.warn(`Warning: source directory '${sourceDir}' does not exist.`);
    return;
  }
  // Ensure the destination directory exists
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  // Get a list of all files and directories in the source directory
  const items = fs.readdirSync(sourceDir);

  // Iterate through the items in the source directory
  for (const item of items) {
    const sourceItemPath = path.join(sourceDir, item);
    const destinationItemPath = path.join(destinationDir, item);

    // Check if the item is a file
    if (fs.statSync(sourceItemPath).isFile()) {
      fs.copyFileSync(sourceItemPath, destinationItemPath);
    } else {
      // If it's a directory, recursively copy it
      copyDirectorySync(sourceItemPath, destinationItemPath);
    }
  }
}


exports.copyDir = function copyDir(scope,path,relativeSrcPath,dirName,destPath){
  let modules = searchModulesInDirectory(path+relativeSrcPath)
  console.log(`Copying ${dirName} for modules: ${modules}`)
  modules.forEach(m => {
    copyDirectorySync(path+"/node_modules/"+scope+"/"+m+"/dist/wm"+dirName, path+destPath)
  })
}