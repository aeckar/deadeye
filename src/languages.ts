// language-specific utilities

import Tape from './tape';

// flags: {
//     ['p', 'pub'],
//     ['m', 'mut'],
//     ['a', 'async'],
//     ['b', '&'],
// },

export const rust = {
    pubFlag(tape: Tape): string {
        if (tape.isAt('p')) {
            tape.adv();
            return 'pub ';
        }
        return '';
    },
    mutFlag(tape: Tape): string {
        if (tape.isAt('m')) {
            tape.adv();
            return 'mut ';
        }
        return '';
    },
    asyncFlag(tape: Tape): string {
        if (tape.isAt('a')) {
            tape.adv();
            return 'async ';
        }
        return '';
    },
    borrowFlag(tape: Tape): string {
        if (tape.isAt('b')) {
            tape.adv();
            return '&';
        }
        return '';
    },
    // ['ls', 'static'], // `mut ` comes after

    // first in line, top-level or struct/enum scope
    // ['t', 'type'],
    // ['lc', 'const'],
    // ['a', '#[$0]'],

    // non-exportable top-level elements
    // nonPubItems: new Map([['i', 'impl$0']]),

    // lifetimes(flags) {
    //     return (
    //         [...flags.toLowerCase()].find(ch => ch >= 'a' && ch <= 'd') ??
    //         ''
    //     );
    // },
};

export const ts = {
    // flags: {
    //     export: flags => (check(flags, 'e') ? 'export ' : ''),
    //     default: flags => (check(flags, 'd') ? 'default ' : ''),
    // },
};

// javaScript: {
//     flags: {},
// },
// c: {
//     flags: {},
// },
// cpp: {
//     flags: {},
// },
// java: {
//     flags: {},
// },
// kotlin: {
//     flags: {},
// },
// dart: {
//     flags: {},
// },
// html: {
//     flags: {},
// },
// css: {
//     flags: {},
// },
// yaml: {
//     flags: {},
// },
// toml: {
//     flags: {},
// },
// json: {
//     flags: {},
// },
// md: {
//     flags: {},
//     // tables
// },
