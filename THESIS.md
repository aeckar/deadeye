# Philosophy

<small><b>Written By:</b> Angel Eckardt</small>\
<small><b>Published:</b> 7/29/26</small>\
<small><b>Last edited:</b> 7/29/26 12:04 PM</small>

## Problem Statement

We are currently at the cusp of a new frontier in software engineering. Ever since large-language models garnered widespread adoption in the early 2020s, we have seen a transformation in how software is architected, written, and maintained.

Instead of keying in thousands of lines of code, the industry has made a concerted effort to push software developers to the role of overseer. Instead of applying domain-specific knowledge to fine-tune an application, the current trend is to deploy agents to cover every stage in the software development lifecycle. At the coding level, however, the transfer of control to agents poses the threat of doing more harm than good for certain applications.

Compilers, embedded systems, and cutting-edge technology struggle the most when building using agentic workflows. Unlike the boilerplate, glue code, and web endpoints that generative AI excels in, these hyper-niche systems are less prominent in datasets used to train models. This is compounded by the fact that these forms of software are inherently more difficulty to automate correctly considering they often rely on complex state management and subtle assumptions.

## Proposal

To further empower developers in the areas where AI fails, we have engineered a unique solution at the editor level. It is an add-on the user's preferred editor that generates and augments code by intercepting keystrokes. Hooking into the most atomic form of user input provides several key benefits and obstacles.

**Benefits**

- **Maximum Ergonomics:** Users need not take their hands off the keyboard
- **Maximum Responsiveness:** Users need not switch modes or navigate menus

**Obstacles**

- **Performance Constraints:** Stuttering is unacceptable
- **Learning Curve:** Keystroke-level refactorings require precision and familiarity
