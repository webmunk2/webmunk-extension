const fs = require('fs');
const path = require('path');
const _ = require('lodash')

const searchPattern = /@webmunk\/(\S+)\//g;
const singleLineCommentPattern = /\/\/.*/g;
const multiLineCommentPattern = /\/\*[\s\S]*?\*\//g;

const excludedModules = ["utils"];

function extractNamesFromFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Remove single-line comments
    content = content.replace(singleLineCommentPattern, '');

    // Remove multi-line comments
    content = content.replace(multiLineCommentPattern, '');
    const matches = [];
    let match;
    while ((match = searchPattern.exec(content)) !== null) {
        if (excludedModules.indexOf(match[1]) == -1){
            matches.push(match[1]);
        }
    }

    return _.uniq(matches);
}


exports.searchModulesInDirectory = function searchModulesInDirectory(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const extractedNames = [];

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules') {
                extractedNames.push(...searchModulesInDirectory(path.join(directory, entry.name)));
            }
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
          console.log("Scanning: "+entry.name)  
          extractedNames.push(...extractNamesFromFile(path.join(directory, entry.name)));
        }
    }

    return _.uniq(extractedNames);
}
// test
function test(){
    let modules = searchModulesInDirectory("./src")
    console.log("Modules:"+modules)
    return modules;
}

