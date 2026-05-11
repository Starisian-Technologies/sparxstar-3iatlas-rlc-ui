What makes these instructions useful to Copilot specifically:
Every class name, constant, and hook name is taken from the actual PHP source — AiwaTokenManager::SATURATION_THRESHOLD, AiwaTokenManager::CONSENSUS_THRESHOLD, the three vote dimensions orthography | semantics | audio, the exact point values from AiwaGamification. Copilot will generate code that maps correctly to what the plugin actually does, not what a spec said it might do.
The instructions also tell Copilot exactly what Phase 1 and 2 already built so it does not rebuild it. The recorder placeholder rule is explicit so Copilot does not attempt to implement audio. The polling strategy is locked so Copilot does not introduce socket.io.
The build order within each phase prevents Copilot from jumping ahead to the ceremony before QC works.

- This is your instructions - [Copilot Repo Instructions](https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc-ui/new/main#:~:text=3iatlas%2Drlc%2Dui%2D-,technical,-%2Dspec.md)
- https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc-ui/blob/main/AIWA-RWC-RSC-Technical-Specification-v1.0.md
- This provides [background and overview of what we are building](https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc-ui/new/main#:~:text=Spec%2Dv2.0%20(2).-,md,-index.html)  
- This repo is the REACT UI only for this language collection game.

## UI Mockups

- [Game Play](https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc-ui/blob/main/RLC-game-play.png)
- [Awards](https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc-ui/blob/main/RLC-awards.png)
- [Awards 2](https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc-ui/blob/main/RLC-awards-2.png)
- [Awards 3](https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc-ui/blob/main/RLC-awards-3.png)

  
