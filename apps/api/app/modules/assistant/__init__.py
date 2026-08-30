"""The Studio Assistant module -- grounded chat, per M6.

Answers one question: given a passage and a reader's question, produce an
answer that cites the exact chunks it was built from, and says plainly when
it could not find much to ground itself in. Reuses the retrieval module's
embedding ports rather than re-implementing vector search; its own concern
is the chat completion and the confidence/citation contract around it.
"""
