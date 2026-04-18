const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const token = argv[i];
        if (token.startsWith('--')) {
            const key = token.slice(2);
            const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
            args[key] = value;
        }
    }
    return args;
}

function inferTargetPath(sourcePath, lang) {
    const ext = path.extname(sourcePath);
    const dir = path.dirname(sourcePath);
    const base = path.basename(sourcePath, ext);
    const nextBase = base.replace(/_en$/i, `_${lang}`);
    return path.join(dir, `${nextBase}${ext}`);
}

function runNodeScript(scriptPath, scriptArgs) {
    const run = spawnSync('node', [scriptPath, ...scriptArgs], {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
    });

    const stdout = (run.stdout || '').trim();
    const stderr = (run.stderr || '').trim();

    let parsed = null;
    if (stdout) {
        try {
            parsed = JSON.parse(stdout);
        } catch {
            parsed = { raw: stdout };
        }
    }

    return {
        ok: run.status === 0,
        exitCode: run.status,
        stdout,
        stderr,
        parsed
    };
}

function main() {
    const args = parseArgs(process.argv);

    const srcArg = args.src;
    const lang = (args.lang || 'fr').toLowerCase();
    const provider = (args.provider || 'passthrough').toLowerCase();
    const schemaArg = args.schema || 'schemas/thematic_lexicon.xsd';
    const draftJsonArg = args['draft-json'];
    const policyFileArg = args['policy-file'];
    const policyInlineArg = args.policy;

    if (!srcArg) {
        console.error('Usage: node scripts/translation/run_pipeline.js --src <source.xml> --lang <code> [--provider passthrough|mock|openai-compatible] [--schema <schema.xsd>] [--draft-json <file.json>] [--policy-file <file.json>] [--policy <inline-json>]');
        process.exit(2);
    }

    const srcPath = path.resolve(process.cwd(), srcArg);
    if (!fs.existsSync(srcPath)) {
        console.error(`Source file not found: ${srcPath}`);
        process.exit(2);
    }

    const outPath = inferTargetPath(srcPath, lang);
    const schemaPath = path.resolve(process.cwd(), schemaArg);

    const steps = [];

    const translateStep = runNodeScript('scripts/translation/translate_entries.js', [
        '--src', srcPath,
        '--lang', lang,
        '--mode', 'draft',
        '--provider', provider,
        '--out', outPath
    ]);
    steps.push({ name: 'translate', ...translateStep });
    if (!translateStep.ok) {
        console.log(JSON.stringify({ valid: false, failedStep: 'translate', steps }, null, 2));
        process.exit(1);
    }

    const deterministicStep = runNodeScript('scripts/translation/validate_deterministic.js', [
        '--src', srcPath,
        '--tgt', outPath
    ]);
    steps.push({ name: 'validate_deterministic', ...deterministicStep });
    if (!deterministicStep.ok) {
        console.log(JSON.stringify({ valid: false, failedStep: 'validate_deterministic', steps }, null, 2));
        process.exit(1);
    }

    const llmArgs = [
        '--src', srcPath,
        '--tgt', outPath,
        '--lang', lang
    ];
    if (draftJsonArg) {
        llmArgs.push('--draft-json', path.resolve(process.cwd(), draftJsonArg));
    }
    if (policyFileArg) {
        llmArgs.push('--policy-file', path.resolve(process.cwd(), policyFileArg));
    }
    if (policyInlineArg) {
        llmArgs.push('--policy', String(policyInlineArg));
    }

    const llmStep = runNodeScript('scripts/translation/validate_llm.js', llmArgs);
    steps.push({ name: 'validate_llm', ...llmStep });
    if (!llmStep.ok) {
        console.log(JSON.stringify({ valid: false, failedStep: 'validate_llm', steps }, null, 2));
        process.exit(1);
    }

    const xsdStep = runNodeScript('scripts/translation/validate_xsd.js', [
        '--file', outPath,
        '--schema', schemaPath
    ]);
    steps.push({ name: 'validate_xsd', ...xsdStep });
    if (!xsdStep.ok) {
        console.log(JSON.stringify({ valid: false, failedStep: 'validate_xsd', steps }, null, 2));
        process.exit(1);
    }

    const result = {
        valid: true,
        source: srcPath,
        target: outPath,
        language: lang,
        provider,
        schema: schemaPath,
        steps: steps.map((s) => ({
            name: s.name,
            ok: s.ok,
            exitCode: s.exitCode,
            parsed: s.parsed || null
        }))
    };

    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main();
}
