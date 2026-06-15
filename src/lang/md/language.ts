import Tape from '../../tape';
import { isLowerLetter } from '../../text_manip';

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


// replace -- on copy also, dunno how yet tho
function revise(content: Tape): string {
    if (content.isExhausted()) {
        return '';
    }
    let sentenceBegin = true;
    let revised = '';
    let wordBegin = Tape.isWs(content.cur()!);
    do {
        const ch = content.next()!;

        // === Transform Text ===
        if (sentenceBegin && isLowerLetter(ch)) {
            revised += ch.toUpperCase();
            sentenceBegin = false;
            wordBegin = true;
            continue;
        }
        
        // === Change State ===
        if (ch === '.') {
            sentenceBegin = true;
        }
        
        revised += ch;
    } while (!content.isExhausted());
    return revised;
}
