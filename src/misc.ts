import { Position, Range } from 'vscode';

export function rangeBefore(
    cursor: Position,
    from: number = cursor.character,
): Range {
    if (from < 0) {
        // otherwise, would silently fail
        throw new RangeError(`'from' must be non-negative, got ${from}`);
    }
    if (from > cursor.character) {
        throw new RangeError(
            `'from' (${from}) exceeds cursor character position (${cursor.character})`,
        );
    }
    return new Range(
        new Position(cursor.line, cursor.character - from),
        new Position(cursor.line, cursor.character),
    );
}
export function after(cursor: Position, skip: number = 0): Position {
    return new Position(cursor.line, cursor.character + skip + 1);
} /**
 * Collects each key-value pair in the given object and returns
 * an array of each paired to its index.
 *
 * Most often used for indexed iteration.
 */

export function enumerate<K extends number | string | symbol, V>(o: {
    [T in K]?: V;
}): [number, [K, V]][] {
    // Object.entries returns [string, unknown][], so cast to the expected types
    const entries = Object.entries(o) as unknown as [K, V][];
    return entries.map(
        ([key, val], idx) => [idx, [key, val]] as [number, [K, V]],
    );
}
