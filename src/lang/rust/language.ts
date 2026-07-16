import { IdRule, Language } from '../../languages'

// Closures are too complex to defer to lexer/scope analyzers;
// completion resolvers need to parse them on-the-fly.

export const rustLanguage = Language.newInstance({
    idRule: [
        IdRule.resolve('C_LIKE').startPool,
        IdRule.resolve('C_LIKE').partPool + '#', // `#` for raw identifiers
    ],
    keywords: [
        'as',
        'async',
        'await',
        'break',
        'const',
        'continue',
        'crate',
        'dyn',
        'else',
        'enum',
        'extern',
        'false',
        'fn',
        'for',
        'if',
        'impl',
        'in',
        'let',
        'loop',
        'match',
        'mod',
        'move',
        'mut',
        'pub',
        'ref',
        'return',
        'self',
        'static',
        'struct',
        'super',
        'trait',
        'true',
        'type',
        'unsafe',
        'use',
        'where',
        'while',
        'abstract',
        'become',
        'box',
        'do',
        'final',
        'macro',
        'override',
        'priv',
        'try',
        'typeof',
        'unsized',
        'virtual',
        'yield',
        'union',
    ],
    declare: {
        SELF_TY: 'Self',
        MACRO_RULES: 'macro_rules!',
        FAT_ARROW: '=>',
        THIN_ARROW: '->',
        PATH_SEP: '::',
        QMARK: '?',
        RANGE_INCL: '..=',
        RANGE: '..',
        FLOAT: /[0-9_]+\.[0-9_]+(?:[eE][-+]?[0-9_]+)?(?:f(?:16|32|64|128))?|[0-9_]+[eE][-+]?[0-9_]+(?:f(?:16|32|64|128))?/y,
        LIFETIME: /'[a-zA-Z_][a-zA-Z0-9_]*(?!')/y,
        RAW_IDENT: /r#[a-zA-Z_][a-zA-Z0-9_]*/y,
        DOLLAR: '$',

        // Patterns safely bypass escaped interior quotes, \" and \'
        STRING: /"(?:[^"\\]|\\.)*"/y,
        BYTE_STRING: /b"(?:[^"\\]|\\.)*"/y,
        BYTE_CHAR: /b'(?:[^'\\]|\\.)'/y,

        // Raw strings: r"...", r#"..."#, r##"..."##, and their byte-string forms.
        // Backreference to `#{1,}` isn't possible in a single sticky regex,
        // so this caps at a reasonable number of `#` fences (adjust if you need more).
        RAW_STRING: /r#{0,8}"[\s\S]*?"#{0,8}/y,
        RAW_BYTE_STRING: /r?b#{0,8}"[\s\S]*?"#{0,8}/y,

        // Hex/Binary/Octal checked BEFORE base-10 to prevent early '0' cutoff
        INTEGER:
            /(?:0x[0-9a-fA-F_]+|0b[01_]+|0o[0-7_]+|[0-9_]+)(?:[iu](?:8|16|32|64|128))?/y,
        
        CLOSE
    },
    inherit: [
        'BRACKETS',
        'ARITH_ASSIGN',
        'REM_ASSIGN',
        'BIT_OPS_ASSIGN',
        'BOOL_LOGIC',
        'C_COMMENTS',
        'C_PUNCT',
        'C_ID',
        'C_CHAR',
    ],
    ignore: /\s*/y,
})

export default rustLanguage
