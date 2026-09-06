# 02: Media clues (image & video)

**What to build:** A clue carrying an `image` renders that image above the question text in the modal. A clue carrying a `video` embeds a player that seeks to the `question` segment when the modal opens and seeks to the `answer` segment when the answer is revealed. The sample question set includes at least one image clue and one video clue to exercise both paths.

**Blocked by:** 01 (Re-review: core gameplay & audio)

**Status:** ready-for-agent

- [ ] Normalizer preserves `image` and `video` properties on each clue through Format A and Format B conversion
- [ ] A clue with an `image` property displays the image above the question text in the clue modal
- [ ] A clue with a `video` property embeds a player (YouTube or native) that seeks to `video.segments.question` start/end on modal open
- [ ] When the answer is revealed, the embedded player seeks to `video.segments.answer` start/end and plays
- [ ] Missing or partial `video.segments` (no start/end) defaults to playing from 0 to end
- [ ] `data/questions.json` includes at least one clue with an `image` URL and one clue with a `video` object (YouTube URL with `question` and `answer` segments)
- [ ] Clues without media render identically to today (no empty player, no broken image)
