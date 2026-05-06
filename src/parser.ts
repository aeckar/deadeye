/*



modifiers := 'hot' | 'unit' | 'raw' | 'pre' | 'post'

\\\ Documented Property
hot unit d(p?)m
    \\\ {_}
    {_1?:'pub '}{name}: {},

{
    
}

*/
/// snippets use js instead of ts for efficiency per keystroke
// multiline mode context: error on use ^ $
// '^use' -> 'use '
/*
builtins:
    formatters (operate on id fragments)
        pascal
        scream
        kebab
        snake
    filename    (useful for .g.rs or DSL-like files)
    filedir
*/
// import { Expr, CursorStop, Fragment, Slot, Snippet, Error } from "./parser_utils";
// import { Tape } from "./tape";

// function seekClosingCurly(tape: Tape): boolean {
//     let braceCount = 1;
//     for (const ch of tape) {
//         if (ch === '{') {
//             braceCount++;
//         }
//         if (ch === '}') {
//             braceCount--;
//             if (braceCount === 0) {
//                 return true;
//             }
//         }
//     }
//     return false;
// }

// function parseFile(input: string): Snippet | Error {
//     let global;
//     let 
//     const tape = new Tape(input);
    
//     // Extract shared JS logic
//     tape.consumeWs();
//     if (tape.cur() === '{') {
//         if (!seekClosingCurly(tape)) {
//             return {
//                 start: 0,
//                 end: 1,
//                 cause: "Missing closing curly brace."
//             };
//         }
//         global = tape.raw.slice(1, tape.pos);
//         tape.consumeWs();
//         if (tape.cur() === '\n') {
//             tape.adv();
//         }
//     }
