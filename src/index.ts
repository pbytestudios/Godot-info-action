import * as core from '@actions/core';
import * as fs from 'fs';
import path from 'path';
import sanitize from 'sanitize-filename';

const GODOT_PRJ_FILE = "project.godot";
const ITCH_PRJ_KEY = "itch_project"

type IniType = { [id: string]: MapType | MapType} 
type MapType = {[id: string] : string};

//Note: To build this file, type from the command line:
//npm run build

function parseINIString(data:string): IniType {
    var regex = {
        section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
        param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
        comment: /^\s*;.*$/
    };
    
    var ini:IniType = {};
    var lines:string[] = data.split(/[\r\n]+/);
    var section:string|null = null;
    lines.forEach(function (line) {
        //Skip comments
        if (regex.comment.test(line)) {
            return;
        //Do we have a parameter?
        } else if (regex.param.test(line)) {
            var match = line.match(regex.param);
            if(match == null || match.length == 0)
                return;
            var parameter:string = match[1].replace(/"/g,'');
            var val:string =  match[2].replace(/"/g,'')
            if (section) {
                ini[section][parameter] = val;
            } else {
                //remove double quotes
                ini[''][parameter] = val;
            }
        //Check to see if we have a new section...
        } else if (regex.section.test(line)) {
            var match = line.match(regex.section);
            if(match == null || match.length == 0)
                return;
            section = match[1];
            ini[section] = {};
        } else if (line.length == 0 && section) {
            section = null
        };
    });
    return ini;
}

function hasFile(relativePath:string, filename:string): boolean {
    try {
        const projectPath = path.resolve(relativePath);
        return fs.statSync(path.join(projectPath, filename)).isFile();
    } catch (e) {
        return false;
    }
}

function run(): void {
    try {
        const relProjectPath = core.getInput('relative_project_path');
        const projectPath = path.resolve(relProjectPath);
        // console.log(`Absolute Project Path: ${projectPath}`)

        //Setup our defaults - do we need to do this?
        core.setOutput("require_wine", false);

        if (!hasFile(relProjectPath, 'export_presets.cfg')) {
            core.setFailed(`No export_presets.cfg found in ${relProjectPath}. You must have at least one export defined via the Godot editor!`);
        }
        else {
            const exportFile = path.join(projectPath, 'export_presets.cfg');
            var data = fs.readFileSync(exportFile, 'utf8');
            var ini = parseINIString(data);

            //Get the valid sections only
            var valid_sections:Array<string> = [];
            Object.keys(ini).forEach(section => {
                if (!section.endsWith('.options') || section.length == 0) {
                    var export_path = ini[section]['export_path'];
                    // console.log(`export: ${export_path}`)
                    if (!export_path || export_path.length == 0) {
                        var name = sanitize(ini[section]['name']);
                        core.warning(`No path set for preset '${name}'/ Skipping!`);
                    }
                    else
                        valid_sections.push(section);
                }
            });
            valid_sections.forEach(section => {
                var name = sanitize(ini[section]['name']);
                var platform = ini[section]['platform'];
                var archiveName = `${name}.zip`;
                console.log(`Found ${name}.zip on platform '${platform}'`);
                if (platform == "Windows Desktop") {
                    core.setOutput("windows_artifact", archiveName);
                    core.setOutput("require_wine", true);
                }
                else if (platform == "HTML5")
                    core.setOutput("html5_artifact", archiveName);
                else if (platform == "Mac OSX")
                    core.setOutput("osx_artifact", archiveName);
                else if (platform == "Linux/X11")
                    core.setOutput("linux_artifact", archiveName);
                else if (platform == "Android")
                    core.setOutput("android_artifact", archiveName);
            });
        }

        //Now look for the itch_project setting in the godot project file
        const godotFile = path.join(projectPath, GODOT_PRJ_FILE);
        var data = fs.readFileSync(godotFile, 'utf8');
        var ini = parseINIString(data);

        if(ini['global'] == null || !ini['global'][ITCH_PRJ_KEY] || ini['global'][ITCH_PRJ_KEY].length == 0){
            core.warning(`Unable to find '${ITCH_PRJ_KEY}' in '${GODOT_PRJ_FILE}'. Set '${ITCH_PRJ_KEY}'= the itch.io project name to export to.`);
        }
        else{
            var itch_project = ini['global'][ITCH_PRJ_KEY];
            core.setOutput("itch_project", itch_project);
            console.log(`Itch project found: ${itch_project}`);
        }
    }
    catch (error) {
        if (typeof error === "string") {
            core.setFailed(error);
        } else if (error instanceof Error) {
            core.setFailed(error.message);
        }
        process.exit(1);
    }
}

run();