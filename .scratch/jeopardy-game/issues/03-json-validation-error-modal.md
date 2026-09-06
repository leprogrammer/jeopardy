# 03: JSON validation & error modal

**What to build:** Uploaded and auto-loaded JSON is validated against the schema before use. Invalid data triggers a user-friendly error modal with a clear, specific message — not a bare `alert`. File upload enforces a 5 MB size limit and MIME-type / extension check. A parse spinner is visible while reading a file. A failed `fetch` of the default question set prompts the user to retry or load a different file.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A `#error-modal` overlay exists in the HTML with a title, message area, and close button
- [ ] JSON is validated for: required fields present (`rounds`, `categories`, `clues`, `value`, `question`, `answer`), no duplicate Daily Doubles in a single category, clue values within the expected range for the round
- [ ] Validation failures show the error modal with a human-readable description of what's wrong and where (e.g. category name, clue index)
- [ ] Files larger than 5 MB are rejected with a concise warning in the error modal
- [ ] Files with a MIME type other than `application/json` or an extension other than `.json` are rejected with an error
- [ ] A spinner is shown while a file is being read and parsed
- [ ] If the default `data/questions.json` fetch fails (network error or 404), the user sees a message prompting them to upload a file instead — no silent failure
- [ ] The Start button remains disabled until valid data is loaded
- [ ] Replacing an invalid file with a valid one via the upload control works without a page reload
