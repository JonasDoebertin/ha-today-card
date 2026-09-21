/**
 * Enforce a floor on the coverage of `src/` as a whole.
 *
 * Bun has a `coverageThreshold` setting, but it is applied per file, so the
 * lowest file in the tree decides what the number can be: `action-handler.ts`
 * sits at 60% of functions because Lit never calls a directive's `render`
 * when its `update` returns `noChange`. A floor of 0.6 across every file says
 * nothing about whether the suite still covers the card. This reads the same
 * run's lcov report and checks the totals instead.
 *
 * Run through `bun run test:coverage`, which produces the report first.
 */

// Set below what the suite measures today, 96.46% of 113 functions and 99.32%
// of 1037 lines, with room for an ordinary refactor: about four functions and
// eight lines of slack. Checked against deleting each of the three largest
// test files, all of which fall below these.
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
    // An empty report means the run did not measure anything, which should
    // fail rather than read as perfect coverage.
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
