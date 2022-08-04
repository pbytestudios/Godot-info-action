const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');

function parseINIString(data){
    var regex = {
        section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
        param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
        comment: /^\s*;.*$/
    };
    var value = {};
    var lines = data.split(/[\r\n]+/);
    var section = null;
    lines.forEach(function(line){
        if(regex.comment.test(line)){
            return;
        }else if(regex.param.test(line)){
            var match = line.match(regex.param);
            if(section){
                value[section][match[1]] = match[2];
            }else{
                value[match[1]] = match[2];
            }
        }else if(regex.section.test(line)){
            var match = line.match(regex.section);
            value[match[1]] = {};
            section = match[1];
        }else if(line.length == 0 && section){
            section = null;
        };
    });
    return value;
}

function hasExportPresets() {
  try {
    const projectPath = path.resolve(RELATIVE_PROJECT_PATH);
    return fs.statSync(path.join(projectPath, 'export_presets.cfg')).isFile();
  } catch (e) {
    return false;
  }
}

try {
    const relProjectPath = core.getInput('relative_project_path');
    console.log(`Relative Path: ${relProjectPath}`)
    const projectPath = path.resolve(relProjectPath);
    console.log(`Absolute Project Path: ${projectPath}`)

    //Setup our defaults - do we need to do this?
    core.setOutput("win_artifact", "")
    core.setOutput("html5_artifact", "")
    core.setOutput("osx_artifact", "")
    core.setOutput("linux_artifact", "")
    core.setOutput("android_artifact", "")

    if (!hasExportPresets()) {
        core.setFailed('No export_presets.cfg found. You mus have at least one export defined via the Godot editor!');
    }
    else {
        const exportFile = path.join(projectPath, 'export_presets.cfg');
        var data = fs.readFileSync(exportFile, 'utf8');
        var ini = parseINIString(data);

        //Get the valid sections only
        var valid_sections = []
        Object.keys(ini).forEach(key => {
            if (!key.endsWith('.options'))
                valid_sections.push(key);
        });
        valid_sections.forEach(section => {
            var name = ini[section]['name'].replace(/"/g, '');
            var platform = ini[section]['platform'].replace(/"/g, '');
            var archiveName = `${name}.zip`;
            console.log(`Found ${name}.zip on platform '${platform}'`)
            if (platform == "Windows Desktop")
            core.setOutput("win_artifact", archiveName)
            else if(platform == "HTML5")
            core.setOutput("html5_artifact", archiveName)
            else if(platform == "Mac OSX")
            core.setOutput("osx_artifact", archiveName)
            else if(platform == "Linux/X11")
            core.setOutput("linux_artifact", archiveName)
            else if(platform == "Android")
            core.setOutput("android_artifact", archiveName)});
    }
}
catch (error) {
    core.setFailed(error.message);
   process.exit(1);
}