import { CompletionFamily } from '../completion_utils';
import rust from './rust/completions';
import typescript from './ts/completions';

const completionFamilies: Record<string, CompletionFamily<any>[]> = {
    rust,
    typescript
};

export default completionFamilies;

// lgx lg

//todo space after function in js -- insert smart parentheses
