/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2020-2022  Yomichan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'assert';
import childProcess from 'child_process';
import fs from 'fs';
import JSZip from 'jszip';
import {fileURLToPath} from 'node:url';
import path from 'path';
import readline from 'readline';
import {buildLibs} from '../build-libs.js';
import {ManifestUtil} from '../manifest-util.js';
import {getAllFiles, testMain} from '../util.js';
import {parseArgs} from 'util';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} directory
 * @param {string[]} excludeFiles
 * @param {string} outputFileName
 * @param {string[]} sevenZipExes
 * @param {?import('jszip').OnUpdateCallback} onUpdate
 * @param {boolean} dryRun
 */
async function createZip(directory, excludeFiles, outputFileName, sevenZipExes, onUpdate, dryRun) {
    try {
        fs.unlinkSync(outputFileName);
    } catch (e) {
        // NOP
    }

    if (!dryRun) {
        for (const exe of sevenZipExes) {
            try {
                const excludeArguments = excludeFiles.map((excludeFilePath) => `-x!${excludeFilePath}`);
                childProcess.execFileSync(
                    exe,
                    [
                        'a',
                        outputFileName,
                        '.',
                        ...excludeArguments
                    ],
                    {
                        cwd: directory
                    }
                );
                return;
            } catch (e) {
                // NOP
            }
        }
    }
    await createJSZip(directory, excludeFiles, outputFileName, onUpdate, dryRun);
}

/**
 * @param {string} directory
 * @param {string[]} excludeFiles
 * @param {string} outputFileName
 * @param {?import('jszip').OnUpdateCallback} onUpdate
 * @param {boolean} dryRun
 */
async function createJSZip(directory, excludeFiles, outputFileName, onUpdate, dryRun) {
    const files = getAllFiles(directory);
    removeItemsFromArray(files, excludeFiles);
    const zip = new JSZip();
    for (const fileName of files) {
        zip.file(
            fileName.replace(/\\/g, '/'),
            fs.readFileSync(path.join(directory, fileName), {encoding: null, flag: 'r'}),
            {}
        );
    }

    if (typeof onUpdate !== 'function') {
        onUpdate = () => {}; // NOP
    }

    const data = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {level: 9}
    }, onUpdate);
    process.stdout.write('\n');

    if (!dryRun) {
        fs.writeFileSync(outputFileName, data, {encoding: null, flag: 'w'});
    }
}

/**
 * @param {string[]} array
 * @param {string[]} removeItems
 */
function removeItemsFromArray(array, removeItems) {
    for (const item of removeItems) {
        const index = getIndexOfFilePath(array, item);
        if (index >= 0) {
            array.splice(index, 1);
        }
    }
}

/**
 * @param {string[]} array
 * @param {string} item
 * @returns {number}
 */
function getIndexOfFilePath(array, item) {
    const pattern = /\\/g;
    const separator = '/';
    item = item.replace(pattern, separator);
    for (let i = 0, ii = array.length; i < ii; ++i) {
        if (array[i].replace(pattern, separator) === item) {
            return i;
        }
    }
    return -1;
}

/**
 * @param {string} buildDir
 * @param {string} extDir
 * @param {ManifestUtil} manifestUtil
 * @param {string[]} variantNames
 * @param {string} manifestPath
 * @param {boolean} dryRun
 * @param {boolean} dryRunBuildZip
 * @param {string} yomitanVersion
 */
async function build(buildDir, extDir, manifestUtil, variantNames, manifestPath, dryRun, dryRunBuildZip, yomitanVersion) {
    const sevenZipExes = ['7za', '7z'];

    // Create build directory
    if (!fs.existsSync(buildDir) && !dryRun) {
        fs.mkdirSync(buildDir, {recursive: true});
    }

    const dontLogOnUpdate = !process.stdout.isTTY;
    /** @type {import('jszip').OnUpdateCallback} */
    const onUpdate = (metadata) => {
        if (dontLogOnUpdate) { return; }

        let message = `Progress: ${metadata.percent.toFixed(2)}%`;
        if (metadata.currentFile) {
            message += ` (${metadata.currentFile})`;
        }

        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(message);
    };

    process.stdout.write(`Version: ${yomitanVersion}...\n`);

    for (const variantName of variantNames) {
        const variant = manifestUtil.getVariant(variantName);
        if (typeof variant === 'undefined' || variant.buildable === false) { continue; }

        const {name, fileName, fileCopies} = variant;
        let {excludeFiles} = variant;
        if (!Array.isArray(excludeFiles)) { excludeFiles = []; }

        process.stdout.write(`Building ${name}...\n`);

        const modifiedManifest = manifestUtil.getManifest(variant.name);

        ensureFilesExist(extDir, excludeFiles);

        if (typeof fileName === 'string') {
            const fileNameSafe = path.basename(fileName);
            const fullFileName = path.join(buildDir, fileNameSafe);
            if (!dryRun) {
                fs.writeFileSync(manifestPath, ManifestUtil.createManifestString(modifiedManifest).replace('$YOMITAN_VERSION', yomitanVersion));
            }

            if (!dryRun || dryRunBuildZip) {
                await createZip(extDir, excludeFiles, fullFileName, sevenZipExes, onUpdate, dryRun);
            }

            if (!dryRun) {
                if (Array.isArray(fileCopies)) {
                    for (const fileName2 of fileCopies) {
                        const fileName2Safe = path.basename(fileName2);
                        fs.copyFileSync(fullFileName, path.join(buildDir, fileName2Safe));
                    }
                }
            }
        }

        process.stdout.write('\n');
    }
}

/**
 * @param {string} directory
 * @param {string[]} files
 */
function ensureFilesExist(directory, files) {
    for (const file of files) {
        assert.ok(fs.existsSync(path.join(directory, file)));
    }
}

/**
 * @param {string[]} argv
 */
export async function main(argv) {
    /** @type {import('util').ParseArgsConfig['options']} */
    const parseArgsConfigOptions = {
        all: {
            type: 'boolean',
            default: false
        },
        default: {
            type: 'boolean',
            default: false
        },
        manifest: {
            type: 'string'
        },
        dryRun: {
            type: 'boolean',
            default: false
        },
        dryRunBuildZip: {
            type: 'boolean',
            default: false
        },
        version: {
            type: 'string',
            default: '0.0.0.0'
        }
    };

    const {values: args} = parseArgs({args: argv, options: parseArgsConfigOptions});

    const dryRun = /** @type {boolean} */ (args.dryRun);
    const dryRunBuildZip = /** @type {boolean} */ (args.dryRunBuildZip);
    const yomitanVersion = /** @type {string} */ (args.version);

    const manifestUtil = new ManifestUtil();

    const rootDir = path.join(dirname, '..', '..');
    const extDir = path.join(rootDir, 'ext');
    const buildDir = path.join(rootDir, 'builds');
    const manifestPath = path.join(extDir, 'manifest.json');

    try {
        await buildLibs();
        const variantNames = /** @type {string[]} */ ((
            argv.length === 0 || args.all ?
            manifestUtil.getVariants().filter(({buildable}) => buildable !== false).map(({name}) => name) : []
        ));
        await build(buildDir, extDir, manifestUtil, variantNames, manifestPath, dryRun, dryRunBuildZip, yomitanVersion);
    } finally {
        // Restore manifest
        const manifestName = /** @type {?string} */ ((!args.default && typeof args.manifest !== 'undefined') ? args.manifest : null);
        const restoreManifest = manifestUtil.getManifest(manifestName);
        process.stdout.write('Restoring manifest...\n');
        if (!dryRun) {
            fs.writeFileSync(manifestPath, ManifestUtil.createManifestString(restoreManifest).replace('$YOMITAN_VERSION', yomitanVersion));
        }
    }
}

testMain(main, process.argv.slice(2));
