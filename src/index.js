const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');

const ITCH_PRJ_FILE = "itch.txt";

//Note: To build this file, type from the command line:
//npm run build

function parseINIString(data) {
    var regex = {
        section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
        param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
        comment: /^\s*;.*$/
    };
    var value = {};
    var lines = data.split(/[\r\n]+/);
    var section = null;
    lines.forEach(function (line) {
        if (regex.comment.test(line)) {
            return;
        } else if (regex.param.test(line)) {
            var match = line.match(regex.param);
            if (section) {
                value[section][match[1]] = match[2];
            } else {
                value[match[1]] = match[2];
            }
        } else if (regex.section.test(line)) {
            var match = line.match(regex.section);
            value[match[1]] = {};
            section = match[1];
        } else if (line.length == 0 && section) {
            section = null;
        };
    });
    return value;
}

function hasFile(relativePath, filename) {
    try {
        const projectPath = path.resolve(relativePath);
        return fs.statSync(path.join(projectPath, filename)).isFile();
    } catch (e) {
        return false;
    }
}

function run() {
    try {
        const relProjectPath = core.getInput('relative_project_path');
        const projectPath = path.resolve(relProjectPath);
        // console.log(`Absolute Project Path: ${projectPath}`)

        //Setup our defaults - do we need to do this?
        core.setOutput("require_wine", false)

        if (!hasFile(relProjectPath, 'export_presets.cfg')) {
            core.setFailed(`No export_presets.cfg found in ${relProjectPath}. You must have at least one export defined via the Godot editor!`);
        }
        else {
            const exportFile = path.join(projectPath, 'export_presets.cfg');
            var data = fs.readFileSync(exportFile, 'utf8');
            var ini = parseINIString(data);

            //Get the valid sections only
            var valid_sections = []
            Object.keys(ini).forEach(section => {
                if (!section.endsWith('.options')) {
                    var export_path = ini[section]['export_path'].replace(/"/g, '');
                    // console.log(`export: ${export_path}`)
                    if (!export_path || export_path.length == 0) {
                        var name = sanitize(ini[section]['name'].replace(/"/g, ''));
                        core.warning(`No path set for preset '${name}'/ Skipping!`);
                    }
                    else
                        valid_sections.push(section);
                }
            });
            valid_sections.forEach(section => {
                var name = sanitize(ini[section]['name'].replace(/"/g, ''));
                var platform = ini[section]['platform'].replace(/"/g, '');
                var archiveName = `${name}.zip`;
                console.log(`Found ${name}.zip on platform '${platform}'`)
                if (platform == "Windows Desktop") {
                    core.setOutput("windows_artifact", archiveName)
                    core.setOutput("require_wine", true)
                }
                else if (platform == "HTML5")
                    core.setOutput("html5_artifact", archiveName)
                else if (platform == "Mac OSX")
                    core.setOutput("osx_artifact", archiveName)
                else if (platform == "Linux/X11")
                    core.setOutput("linux_artifact", archiveName)
                else if (platform == "Android")
                    core.setOutput("android_artifact", archiveName)
            });
        }

        if (!hasFile(relProjectPath, ITCH_PRJ_FILE)){
            core.warning(`Unable to find file '${ITCH_PRJ_FILE}' in the Godot project dir '${relProjectPath}'.\nAdd this with the itch project name to allow upload to itch.io.`)
        }
        else{
            const filename = path.join(projectPath, ITCH_PRJ_FILE);
            var data = fs.readFileSync(filename, 'utf8');
            var itch_project = data.match(/\s*([^\s]+)/)[1];
            core.setOutput("itch_project", itch_project);
            core.log(`Itch project found: ${itch_project}`);
        }
    }
    catch (error) {
        core.setFailed(error.message);
        process.exit(1);
    }
}

run();