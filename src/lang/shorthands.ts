import { CompletionFamilySpec } from '../completion_utils';
import rust from './rust/completions';

const shorthands: Record<string, CompletionFamilySpec<any>[]> = {
    rust,
};

export default shorthands;

// lgx lg
