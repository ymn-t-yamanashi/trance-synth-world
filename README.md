# EUPHORIA — Trance Synth World

An independent, synth-first XRift world for playing a trance synthesizer from the computer keyboard. It includes supersaw, pluck and bass timbres, an offbeat bassline with kick-triggered sidechain pumping, an evolving two-bar melodic hook, three detailed drum grooves, three fills, a 14-band logarithmic spectrum meter, disco searchlights and lasers, and ten instances of the linked VRM avatar. The venue uses a unified green-and-black accent palette, invisible spotlight housings, and soft radial green light washes over the stage and floor. The dancers form two rows of five and use independent skeletons with shared model resources. Their procedural headbanging, lowered arm choreography and beat-synced jumps follow the sequencer and audio level, with smaller movement in the intro and breakdown, a rising build, stronger peak movement and a fading outro. The hook uses syncopated phrases and deliberate rests; its A/B call-and-response repeats, then changes for an eight-bar phrase, and follows the selected minor key. The spotlights, beam sweeps, laser spread and brightness react to the sound level and sequencer beat. Sound is generated locally in the browser with Web Audio.

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite address in a Chromium-based browser. Press **START AUTO** once to enable audio and start the sequencer. The computer keyboard plays C4–C5 with this mapping:

| Key | Note | Key | Note | Key | Note |
|---|---|---|---|---|---|
| Z | C4 | 2 | C#4 | X | D4 |
| 3 | D#4 | C | E4 | V | F4 |
| 5 | F#4 | B | G4 | 6 | G#4 |
| N | A4 | 7 | A#4 | M | B4 |
| , | C5 |  |  |  |  |

Pressing a note plays it and immediately sets that note as the minor tonic. The melodic hook and bass progression transpose to follow the selected tonic. **SUPERSAW** and **BASS** sustain while held; **PLUCK** decays naturally. The mapping uses physical key positions and leaves **WASD** available for moving around the world.

## Track arrangement

**START AUTO** plays a 64-bar track and stops after its ending. At 138 BPM, one pass is about 1 minute 51 seconds. Restarting begins from the intro.

| Bars | Section | Arrangement |
|---|---|---|
| 1–8 | Intro | Sparse pluck and hats; kick enters in the second half. |
| 9–16 | Groove | Full selected rhythm, offbeat bass and the hook. |
| 17–24 | Breakdown | Kick and bass drop out, then a sparse kick returns for the final two bars; the hook thins to fragments. |
| 25–32 | Build | Kick, hats and bass rise in stages; the final two bars carry the selected two-bar fill. |
| 33–48 | Peak | Full groove and hook, with a brief hook pullback at phrase ends. |
| 49–56 | Outro | Hook, bass and drums gradually thin out. |
| 57–64 | Ending | The pulse fades, hook fragments disappear, and a resolved minor chord sustains through the final bar before the sequencer stops. |

The same form follows the selected key and tempo. It avoids playing the full hook at peak intensity from start to finish.

Use **RHYTHM** to cycle through **Melodic Drive** (steady kick, offbeat hats and shakers), **Peak-Time Push** (an extra syncopated kick and brighter open hats), and **Hypnotic Broken** (a syncopated kick grid). The bass plays on offbeats and ducks briefly on each kick to keep the low end defined. **FILL TYPE** selects **8→16→32→64 Snare** (an eight-beat roll across two bars), **Tom Descent** (descending tuned toms), or **Hybrid Impact** (clap, tom, noise riser and low tom). **AUTO FILL** plays two-bar fills at phrase boundaries in the groove, build and peak sections. **FILL NOW** queues two full bars, starting at the next downbeat. The 14 VU columns show separate logarithmic frequency bands from 55 Hz to 14 kHz. The key selector cycles through supersaw, pluck and bass. Audio stays in the local browser and is not transmitted to other participants.

## Build

```bash
npm run typecheck
npm run build
```

The world is packaged for XRift through Module Federation. Uploading is a separate action and is not part of local development or verification.

The supplied VRM metadata marks redistribution as prohibited and restricts use to its author. It is included for this local world preview only; do not upload or distribute the model without permission.
