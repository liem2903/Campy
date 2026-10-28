# Mission: Understand every line of Campi

## Why
I'm building Campi checkpoint by checkpoint with Claude writing the code. I want to actually understand every line before it's committed, so I can defend it in the pre-commit quizzes and eventually design and write checkpoints myself.

## Success looks like
- I can explain line by line what a React page does when its data loads asynchronously (Ticket 3 CP1 is the first test)
- I can spot and fix race conditions where a late response overwrites newer state
- I can design a checkpoint before seeing Claude's code

## Constraints
- Lessons are tied to the checkpoint currently being built; short, one concept at a time
- Shaky areas so far: rollback vs commit, DB locks vs JS await, layering, SQL, middleware order, created_at vs updated_at

## Out of scope
- General React/Node courses not tied to Campi's code
