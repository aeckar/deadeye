Yes. Based on your current substitutions, you are building a custom text formatter or code alignment tool.
To expand your Rust formatting rules, here are the remaining core operators and punctuation marks that should always be surrounded by spaces in standard Rust formatting (rustfmt):

## Arithmetic & Assignment Operators

- substitute('+=', ' += ')
- substitute('-=', ' -= ')
- substitute('_=', ' _= ')
- substitute('/=', ' /= ')
- substitute('%=', ' %= ')

## Comparison & Logical Operators

- substitute('==', ' == ')
- substitute('!=', ' != ')
- substitute('&&', ' && ')
- substitute('||', ' || ')
- substitute('<', ' < ') (Be careful, this can break generics like <T> if applied globally)
- substitute('>', ' > ') (Can also break generics if applied globally)
- substitute('<=', ' <= ')
- substitute('>=', ' >= ')

## Bitwise Operators

- substitute('&', ' & ') (Be careful, this can break references like &str or &mut)
- substitute('|', ' | ') (Be careful, this can break closure arguments like |x| x + 1)
- substitute('^', ' ^ ')

## Warning: A Danger to Watch For

Global string substitutions like substitute(':', ': ') can accidentally break valid code spacing elsewhere. For example:

- std::io might incorrectly become std : : io.
- match guards or ranges like 1..=5 might break. [1]

To ensure your substitutions don't break your syntax, are you running these replacements using regex boundaries (\b), or are you processing the file line-by-line?

[1] [https://www.reddit.com](https://www.reddit.com/r/rust/comments/ajovi5/result_vs_resultt_e/)
