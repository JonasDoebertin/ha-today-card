/**
 * Check the coverage of `src/` as a whole against a floor. Bun's own
 * `coverageThreshold` applies per file, so the weakest file would set the
 * number for every file. Also fails if a `src/` file is missing from the
 * report entirely, which happens when no test imports it. Run
 * `bun run test:coverage` first for the report.
 */

// Raise these when the measured coverage rises.
const THRESHOLDS = {
    functions: 93,
    lines: 98.5,
};

const REPORT = "coverage/lcov.info";
const SRC_GLOB = "src/**/*.ts";

interface Totals {
    functionsFound: number;
    functionsHit: number;
    linesFound: number;
    linesHit: number;
}

function readTotals(report: string): Totals {
    const totals: Totals = {
        functionsFound: 0,
        functionsHit: 0,
        linesFound: 0,
        linesHit: 0,
    };

    const fields = {
        FNF: "functionsFound",
        FNH: "functionsHit",
        LF: "linesFound",
        LH: "linesHit",
    } as const;

    for (const line of report.split("\n")) {
        const [prefix, value] = line.split(":");
        const field = fields[prefix as keyof typeof fields];

        if (field !== undefined) {
            totals[field] += Number(value);
        }
    }

    return totals;
}

function reportedFiles(report: string): Set<string> {
    const files = new Set<string>();

    for (const line of report.split("\n")) {
        if (line.startsWith("SF:")) {
            files.add(line.slice("SF:".length));
        }
    }

    return files;
}

/**
 * A file with no executable code (only interfaces, type aliases and ambient
 * declarations) never earns an `SF:` entry, even when imported by tests.
 * Track brace depth so field lines inside an interface/type body don't get
 * mistaken for statements of their own.
 */
function isTypeOnly(source: string): boolean {
    const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

    let depth = 0;

    for (const rawLine of withoutComments.split("\n")) {
        const line = rawLine.trim();

        if (line === "") {
            continue;
        }

        if (depth > 0) {
            depth +=
                (line.match(/{/g)?.length ?? 0)
                - (line.match(/}/g)?.length ?? 0);
            continue;
        }

        const opensTypeBlock =
            /^(export\s+)?(interface\b|type\s+\S+\s*=\s*{|declare\s+(module|global)\b)/.test(
                line,
            );
        const isTypeStatement =
            /^(export\s+)?type\b.*;?$/.test(line)
            || /^import\s+type\b.*;$/.test(line);

        if (!opensTypeBlock && !isTypeStatement) {
            return false;
        }

        if (opensTypeBlock) {
            depth +=
                (line.match(/{/g)?.length ?? 0)
                - (line.match(/}/g)?.length ?? 0);
        }
    }

    return true;
}

async function findUnreportedFiles(report: string): Promise<string[]> {
    const reported = reportedFiles(report);
    const glob = new Bun.Glob(SRC_GLOB);
    const missing: string[] = [];

    for await (const path of glob.scan(".")) {
        if (path.endsWith(".d.ts") || reported.has(path)) {
            continue;
        }

        if (isTypeOnly(await Bun.file(path).text())) {
            continue;
        }

        missing.push(path);
    }

    return missing.sort();
}

function percentage(hit: number, found: number): number {
    // An unmeasured report should fail, not read as perfect coverage.
    return found === 0 ? 0 : (hit / found) * 100;
}

async function main(): Promise<void> {
    const file = Bun.file(REPORT);

    if (!(await file.exists())) {
        console.error(
            `No coverage report at ${REPORT}. Run "bun run test:coverage".`,
        );
        process.exit(1);
    }

    const report = await file.text();
    const totals = readTotals(report);
    const measured = {
        functions: percentage(totals.functionsHit, totals.functionsFound),
        lines: percentage(totals.linesHit, totals.linesFound),
    };

    let failed = false;

    const unreported = await findUnreportedFiles(report);

    if (unreported.length > 0) {
        console.error(
            "No test imports these files, so they are invisible to coverage:",
        );
        for (const path of unreported) {
            console.error(`  ${path}`);
        }
        failed = true;
    }

    for (const [metric, floor] of Object.entries(THRESHOLDS)) {
        const actual = measured[metric as keyof typeof measured];
        const verdict = actual >= floor ? "ok" : "below the floor";

        console.log(
            `${metric}: ${actual.toFixed(2)}% (floor ${floor}%) ${verdict}`,
        );

        if (actual < floor) {
            failed = true;
        }
    }

    if (failed) {
        process.exit(1);
    }
}

await main();

export {};
