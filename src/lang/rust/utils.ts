/**
 * Consumes the next character cluster from the current position
 * with clearance discernable using the Rust specification.
 */
import Tape from '@/tape';

// todo check for edge cases
function consumeRustTarget(tape: Tape): string {
    // : . greedy, then lookbehind
    // can be just delims
    // skip over insides
    // stop at: = , ( [ { <letter after skipped ws>
    // skip ws if after closer after skip of insides
    // also this prefixes (stop here): & &mut *
    const post = ['<>()[]:.'];

    if (tape.isReversed) {
    }
    return 'TODO';
}
