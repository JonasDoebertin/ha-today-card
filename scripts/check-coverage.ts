/**
 * Check the coverage of `src/` as a whole against a floor. Bun's own
 * `coverageThreshold` applies per file, so the weakest file would set the
 * number for every file. Run `bun run test:coverage` first for the report.
 */

// Raise these when the measured coverage rises.
const THRESHOLDS = {
    functions: 93,
    lines: 98.5,
};

const REPORT = "coverage/lcov.info";

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

    const totals = readTotals(await file.text());
    const measured = {
        functions: percentage(totals.functionsHit, totals.functionsFound),
        lines: percentage(totals.linesHit, totals.linesFound),
    };

    let failed = false;

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
