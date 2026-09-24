// Holds src/ coverage to a floor and fails on src/ files missing from the
// report (no test imports them). Run `bun run test:coverage` first.

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

// Files with no executable code (only interfaces, type aliases and ambient
// declarations) never earn an `SF:` entry even when a test imports them; none
// of src/ needs that today, so this stays empty until one does.
const TYPE_ONLY_FILES = new Set<string>();

async function findUnreportedFiles(report: string): Promise<string[]> {
    const reported = reportedFiles(report);
    const glob = new Bun.Glob(SRC_GLOB);
    const missing: string[] = [];

    for await (const path of glob.scan(".")) {
        if (
            path.endsWith(".d.ts")
            || reported.has(path)
            || TYPE_ONLY_FILES.has(path)
        ) {
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
