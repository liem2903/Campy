# The local copy wins, and nothing saves edits to the DB yet

The user understands `shownBody = (noteIdFromUrl && localBodies[noteIdFromUrl]) ?? serverBody`: a local copy (even `''`) wins, and the server's body is used only when there's no local copy. They also understand that in Ticket 3 edits (title and body) live only in local state and localStorage; the DB gets created notes (Ticket 1), and autosave (Ticket 4) will write edits.

**Evidence:** Said a note typed in and then reloaded comes back "from local storage as there is no current code that updates the DB until auto save." Correctly said a never-typed note shows the server's `'Enzymes'` once the reply arrives.

**Implications:** Corrected: (1) before the reply, `shownBody` is `undefined`, not `null` or `''`, and that is what makes the page render nothing; (2) the server's reply doesn't replace a local copy when it arrives ("until it gets updated" was wrong); only typing changes it. Not yet tested: why `??` and not `||` (the `''` case), and Lesson 2's quiz. The user asked for clearer names, so the code and lessons now use noteIdFromUrl, noteList, listEntry, localBodies, serverReply, serverBody, shownBody, getNoteFromServer and noteDetailOrNull.
