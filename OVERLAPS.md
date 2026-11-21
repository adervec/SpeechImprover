# Overlaps and interactions (house standard 27)

Where SpeechImprover and another app, or the hub, hold the same data, do the same job, or could
feed each other. A register for the maker to choose from: **an entry is not permission to build.**

    - [state] App + App: what overlaps -> what could be shared, and through what

Reviewed: 2026-11-21

- [done] SpeechImprover + Tachyread: Tachyread's read-aloud and narration sessions were invisible here -> SpeechImprover imports Tachyread's narration/speaking logs as scored sessions (Settings > Tachyread speech, a folder the reader links; not yet through the shared cloud folder)
- [idea] SpeechImprover + Tachyread: both record you reading a text aloud (Tachyread's speaking minigames and audiobook recording; SpeechImprover's reading projects and the new hour-long "Just speak" book reading) -> open a Tachyread book as a SpeechImprover reading project, and let a Just speak book sitting advance the Tachyread reading position; one passage library
- [idea] SpeechImprover + Tachyread: the halves / thirds / quarters "how did it hold up" analysis is written twice (Tachyread's typing-run splits, SpeechImprover's take splits and sitting chunks) -> one small shared splits helper in font.js
- [idea] SpeechImprover + Tachyread: Tachyread has its own read-aloud filler counter and pronunciation check, SpeechImprover scores fillers and clarity -> Tachyread hands the recording's measurements to one scorer instead of keeping a second, simpler one
- [idea] SpeechImprover + LanguageLab: LanguageLab needs speech capture and scoring that SpeechImprover already has (recorder, live analyser, attribute scores, the long-sitting engine) -> a shared speech module instead of a second copy
- [idea] SpeechImprover + hub: the app keeps its own day streak and weekly goal, and the hub draws streaks and habits from the session ledger -> the hub's numbers could replace the app's own, or the app could read the ledger so the two never disagree
- [idea] SpeechImprover + GymTracker + Tachyread: each has its own AI session-review channel with the same reply shape -> one shared review card (grade, strengths, fixes, next) in cowork.js
