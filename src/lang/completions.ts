import { CompletionFamily } from '../completion_utils';
import rust from './rust/completions';

const completionFamilies: Record<string, CompletionFamily<any>[]> = {
    rust,
};

export default completionFamilies;

// lgx lg
