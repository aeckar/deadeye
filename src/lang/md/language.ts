import Tape from '../../tape';
import { isLetter, isLowerLetter } from '../../text_utils';

// BASICALLY YU GOT
/*
capitalize first word in sentence.
capitalize singular I
replace -- with double em dash

MARKDOWN SPECIFIC
insert space after prefixes
    -
    N. /(. and transform to N.)
    # ## ### #### ##### ######
    >
    
*/

// trim ws
// no multi-spaces between words
// (c) (tm)
// number fmt (e.g. 1,000)
// ` ` after , ; :

function revise(content: Tape): string {
    if (content.isExhausted()) {
        return '';
    }
    let sentenceBegin = true;
    let wordBegin = true;
    let wordStart = 0;
    let wordBuf = '';
    let revised = '';
    while (!content.isExhausted()) {
        const ch = content.next()!;
        if (ch === '-' && content.cur() === '-') {
            // Replace `--` with em dash
            // This already exists as a hot shorthand,
            // but having a branch provides redundancy
            content.pos += 2; // skip `--`
            revised += '——';
            wordBegin = false;
            continue;
        }
        if (sentenceBegin && isLowerLetter(ch)) {
            // Capitalize first letter of sentence
            revised += ch.toUpperCase();
            wordBegin = false;
            sentenceBegin = false;
            continue;
        }
        if (
            wordBegin &&
            ch === 'i' &&
            (content.isExhausted() || !isLetter(content.cur()!))
        ) {
            // Capitalize singular "I"
            revised += 'I';
            wordBegin = false;
            sentenceBegin = false;
            continue;
        }
        if (ch === '.' || ch === '!' || ch === '?') {
            wordBegin = false;
            sentenceBegin = true;
        } else if (Tape.isWs(ch)) {
            wordBegin = true;
        } else if (isLetter(ch)) {
            wordBegin = false;
            sentenceBegin = false;
        } else {
            wordBegin = false;
        }
        revised += ch;
    }
    return revised;
}
