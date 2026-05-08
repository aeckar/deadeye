//! Language-specific utilities.
import Tape from './tape';

export const rust = {
    pubFlag(tape: Tape): string {
        return tape.consumeAt('p') ? 'pub ' : '';
    },
    mutFlag(tape: Tape): string {
        return tape.consumeAt('m') ? 'mut ' : '';
    },
    asyncFlag(tape: Tape): string {
        return tape.consumeAt('a') ? 'async ' : '';
    },
    borrowFlag(tape: Tape): string {
        return tape.consumeAt('b') ? '&' : '';
    },
};

// ts
// javaScript
// c
// cpp
// java
// kotlin
// dart
// html
// css
// yaml
// toml
// json
// md
