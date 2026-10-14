#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const PACKAGE = '@koralabs/kora-labs-common';
const VERSION = '6.9.3';

function loadPolicy(packageDirectory) {
    const manifest = packageDirectory
        ? path.resolve(packageDirectory, 'package.json')
        : require.resolve(`${PACKAGE}/package.json`);
    const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (metadata.name !== PACKAGE || metadata.version !== VERSION) {
        throw new Error(`Policy dependency must be ${PACKAGE}@${VERSION}`);
    }
    return require(path.join(path.dirname(manifest), 'protectedWords')).ProtectedWords;
}

async function classify(handle, policy) {
    const normalized = handle.trim().toLowerCase();
    // Candidate format is a CLI input contract, not protected-word policy.
    if (!/^[a-z0-9_.-]{1,15}$/.test(normalized)) {
        return { handle, status: 'INVALID', reason: '1-15 chars, only a-z0-9_.-' };
    }
    const result = await policy.checkAvailability(normalized);
    return { handle, status: result.available ? 'OK' : 'FLAGGED', reason: result.available ? 'Policy allows candidate' : result.reason };
}

async function main(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        options: { 'common-package': { type: 'string' }, help: { type: 'boolean' } },
        allowPositionals: true
    });
    if (values.help) {
        console.log('Usage: node check_badword.cjs <handles_file.txt> [--common-package <package-directory>]');
        return;
    }
    if (positionals.length !== 1) throw new Error('Expected one UTF-8 handles file; use --help');
    const handles = fs.readFileSync(positionals[0], 'utf8').split(/\r?\n/).map(h => h.trim()).filter(Boolean);
    const policy = loadPolicy(values['common-package']);
    console.log(`Offline policy: ${PACKAGE}@${VERSION}; OK does not mean unminted or reservable.`);
    console.log('HANDLE\tSTATUS\tREASON');
    for (const handle of handles) {
        const result = await classify(handle, policy);
        console.log(`${result.handle}\t${result.status}\t${result.reason}`);
    }
}

module.exports = { classify, loadPolicy, main };
if (require.main === module) {
    main(process.argv.slice(2)).catch(error => {
        console.error(`Policy check failed: ${error.message}`);
        process.exitCode = 1;
    });
}
