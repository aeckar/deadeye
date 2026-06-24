Parsing Rust closures is famously tricky because they don't always use explicit curly braces (|x| x + 1) and can look like bitwise OR pipes at a glance. However, if your scope stream successfully identifies that the user is inside a closure, it unlocks powerful, context-aware completions:

1. Smart Parameter & Control Flow Suggestions
   Signature Inference: If the closure is being passed as an argument to an iterator method (like .map(), .filter(), or .any()), your extension can look at the type of the receiver collection and automatically autocomplete the closure parameters with their correct type annotations or names (e.g., suggesting |item| or |(key, value)|).

Control Flow Corrections: Inside a Rust closure, typing return exits the closure, not the enclosing function. If a user types return, you can provide a subtle ghost-text hint or prioritize completion patterns that match the closure's expected return type, helping them avoid accidental control flow bugs.

2. Environment Capture Modifiers (move)
   Async & Threading Scaffolding: Rust closures often require the move keyword when passed to threads or async blocks to capture variables by value. If your engine detects the user is typing a closure inside a std::thread::spawn or a Tokio task, it can automatically complete the closure with the move keyword prefixed (e.g., move |...| {}).

3. Smart Keyword Disabling
   Contextual Filtering: Certain keywords are syntactically illegal inside a normal Rust closure unless nested inside a loop (like break or continue). Knowing the user is in a pure closure scope allows your engine to deprioritize or completely filter out these keywords from the autocomplete dropdown, keeping the suggestions incredibly clean.
