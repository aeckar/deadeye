// keys are accessed often in handlers, so keep names short!

type Language = {
    // prefer 2-arrays over Record
    // $0 is right after unless specified
    hot?: [string, string][];
    [extra: string]: any;
};

export const rust: Language = {
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

export const ts: Language = {
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
