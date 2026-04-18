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

function escapePsSingleQuoted(value) {
    return String(value).replace(/'/g, "''");
}

function runXsdValidation(xmlPath, xsdPath) {
    const psXml = escapePsSingleQuoted(xmlPath);
    const psXsd = escapePsSingleQuoted(xsdPath);

    const psScript = `
$ErrorActionPreference = 'Stop'
$xmlPath = '${psXml}'
$xsdPath = '${psXsd}'

if (!(Test-Path -LiteralPath $xmlPath)) { throw "XML file not found: $xmlPath" }
if (!(Test-Path -LiteralPath $xsdPath)) { throw "XSD file not found: $xsdPath" }

$settings = New-Object System.Xml.XmlReaderSettings
$settings.ValidationType = [System.Xml.ValidationType]::Schema
$null = $settings.Schemas.Add($null, $xsdPath)
$errors = New-Object System.Collections.Generic.List[string]

$handler = [System.Xml.Schema.ValidationEventHandler]{
    param($sender, $args)
    $errors.Add($args.Message)
}
$settings.add_ValidationEventHandler($handler)

$reader = [System.Xml.XmlReader]::Create($xmlPath, $settings)
try {
    while ($reader.Read()) { }
} finally {
    $reader.Close()
}

$result = [ordered]@{
    valid = ($errors.Count -eq 0)
    xml = $xmlPath
    schema = $xsdPath
    errors = @($errors)
}
$result | ConvertTo-Json -Depth 5
if ($errors.Count -gt 0) { exit 1 }
`;

    const run = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {
        encoding: 'utf8',
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024
    });

    const stdout = (run.stdout || '').trim();
    const stderr = (run.stderr || '').trim();

    if (stdout) {
        try {
            return {
                exitCode: run.status ?? 0,
                report: JSON.parse(stdout),
                stderr
            };
        } catch (err) {
            return {
                exitCode: run.status ?? 1,
                report: {
                    valid: false,
                    errors: ['Failed to parse PowerShell JSON output.'],
                    raw: stdout
                },
                stderr
            };
        }
    }

    return {
        exitCode: run.status ?? 1,
        report: {
            valid: false,
            errors: [stderr || 'XSD validation failed with no output.']
        },
        stderr
    };
}

function main() {
    const args = parseArgs(process.argv);
    const xmlArg = args.file || args.xml;
    const xsdArg = args.schema;

    if (!xmlArg || !xsdArg) {
        console.error('Usage: node scripts/translation/validate_xsd.js --file <target.xml> --schema <schema.xsd>');
        process.exit(2);
    }

    const xmlPath = path.resolve(process.cwd(), xmlArg);
    const xsdPath = path.resolve(process.cwd(), xsdArg);

    if (!fs.existsSync(xmlPath) || !fs.existsSync(xsdPath)) {
        console.error('XML or schema file does not exist.');
        process.exit(2);
    }

    const result = runXsdValidation(xmlPath, xsdPath);

    const output = {
        valid: Boolean(result.report && result.report.valid),
        xml: xmlPath,
        schema: xsdPath,
        errors: (result.report && result.report.errors) || [],
        stderr: result.stderr || ''
    };

    console.log(JSON.stringify(output, null, 2));

    if (!output.valid) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    runXsdValidation
};
