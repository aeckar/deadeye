const BOOL_PREFIX = new Set(['is', 'has', 'can', 'will', 'should'])
const USIZE_SUFFIX = new Set([
    'idx',
    'index',
    'pos',
    'len',
    'ct',
    'count',
    'cap',
    'capacity',
    'size',
    'sz',
])

/**
 * Returns the most probable type that the identifier with the given chunks
 * will be given, or returns an empty string.
 */
export function inferType(chunks: readonly string[]): string {
    if (USIZE_SUFFIX.has(chunks.at(-1)!)) {
        return 'usize'
    }
    if (chunks.length > 1 && BOOL_PREFIX.has(chunks[0])) {
        return 'bool'
    }
    return ''
}
