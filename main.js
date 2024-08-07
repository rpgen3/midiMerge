(async () => {
  const { importAll, getScript } = await import(
    `https://rpgen3.github.io/mylib/export/import.mjs`
  );
  await Promise.all(
    [
      "https://code.jquery.com/jquery-3.3.1.min.js",
      "https://colxi.info/midi-parser-js/src/main.js",
    ].map(getScript)
  );
  const { $, MidiParser } = window;
  const html = $("body").empty().css({
    "text-align": "center",
    padding: "1em",
    "user-select": "none",
  });
  const head = $("<header>").appendTo(html),
    main = $("<main>").appendTo(html),
    foot = $("<footer>").appendTo(html);
  $("<h1>").appendTo(head).text("MIDIの合併");
  $("<h2>").appendTo(head).text("MIDIのいくつかのトラックの合併");
  const rpgen3 = await importAll(
    ["input", "css", "util"].map(
      (v) => `https://rpgen3.github.io/mylib/export/${v}.mjs`
    )
  );
  const rpgen4 = await importAll(
    [
      "https://rpgen3.github.io/maze/mjs/heap/Heap.mjs",
      "https://rpgen3.github.io/midi/mjs/piano.mjs",
      ["MidiNote", "MidiNoteMessage", "MidiTempoMessage", "toMIDI"].map(
        (v) => `https://rpgen3.github.io/piano/mjs/midi/${v}.mjs`
      ),
    ].flat()
  );
  Promise.all(
    [
      ["deleteBtn", "table"].map(
        (v) => `https://rpgen3.github.io/midiSplit/css/${v}.css`
      ),
      ["container", "tab", "img", "btn"].map(
        (v) => `https://rpgen3.github.io/spatialFilter/css/${v}.css`
      ),
    ]
      .flat()
      .map(rpgen3.addCSS)
  );
  const hideTime = 500;
  const addHideArea = (label, parentNode = main) => {
    const html = $("<div>").addClass("container").appendTo(parentNode);
    const input = rpgen3.addInputBool(html, {
      label,
      save: true,
      value: true,
    });
    const area = $("<dl>").appendTo(html);
    input.elm
      .on("change", () => (input() ? area.show(hideTime) : area.hide(hideTime)))
      .trigger("change");
    return Object.assign(input, {
      get html() {
        return area;
      },
    });
  };
  let g_midi = null;
  let g_is_merge_by_bar = null;
  {
    const { html } = addHideArea("input MIDI file");
    $("<dt>").appendTo(html).text("MIDIファイル");
    const inputFile = $("<input>").appendTo($("<dd>").appendTo(html)).prop({
      type: "file",
      accept: ".mid",
    });
    MidiParser.parse(inputFile.get(0), (v) => {
      g_midi = v;
    });
    $("<dd>").appendTo(html);
    g_is_merge_by_bar = rpgen3.addInputBool(html, {
      label: "二分音符ごとに合併する",
      save: true,
      value: false,
    });
  }
  const makeSafelyGet = (m) => (k) => {
    if (!m.has(k)) m.set(k, []);
    return m.get(k);
  };
  let isMergeList = null;
  let channels = null;
  rpgen3
    .addBtn(main, "view channels", () => {
      if (!g_midi) return table.text("Error: Must input MIDI file.");
      const midiNoteArray = rpgen4.MidiNote.makeArray(g_midi);
      channels = new Map();
      const get = makeSafelyGet(channels);
      for (const midiNote of midiNoteArray)
        get(midiNote.channel).push(midiNote);
      table.empty();
      const tr = $("<tr>")
        .appendTo($("<thead>").appendTo(table))
        .on("click", () => {
          for (const [_, f] of isMergeList) f(!f());
        });
      for (const v of ["MIDI channel", "MIDI note count", "merge"])
        $("<th>").appendTo(tr).text(v);
      const tbody = $("<tbody>").appendTo(table);
      isMergeList = [...channels.keys()]
        .sort((a, b) => a - b)
        .map((channel) => {
          const tr = $("<tr>").appendTo(tbody);
          for (const v of [`Ch.${channel + 1}`, get(channel).length])
            $("<td>").appendTo(tr).text(v);
          return [
            channel,
            rpgen3.addInputBool($("<td>").appendTo(tr), {
              label: "merge",
              value: channel !== 9,
            }),
          ];
        });
    })
    .addClass("btn");
  const table = $("<table>").appendTo(addHideArea("channels").html);
  rpgen3
    .addBtn(main, "start merge", () => {
      if (!g_midi) return table.text("Error: Must input MIDI file.");
      const merged = new Set(
        isMergeList.filter(([_, f]) => f()).map(([channel, _]) => channel)
      );
      const is_merge_by_bar = g_is_merge_by_bar();
      const mergedChannel = mergeChannels(
        [...channels].filter(([channel, _]) => merged.has(channel)),
        is_merge_by_bar
      );
      const unchanged = new Set(
        isMergeList.filter(([_, f]) => !f()).map(([channel, _]) => channel)
      );
      const unchangedChannels = [...channels].filter(([channel, _]) =>
        unchanged.has(channel)
      );
      const { timeDivision } = g_midi;
      rpgen3.download(
        rpgen4.toMIDI({
          tracks: [mergedChannel, ...unchangedChannels]
            .filter((v) => v)
            .map(([channel, midiNoteArray]) => [
              channel,
              rpgen4.MidiNoteMessage.makeArray(midiNoteArray).map(
                (midiNote) => {
                  midiNote.channel = channel;
                  return midiNote;
                }
              ),
            ])
            .sort(([a], [b]) => a - b),
          bpm: rpgen4.MidiTempoMessage.makeArray(g_midi)[0].bpm,
          div: timeDivision,
        }),
        `midiMerge.mid`
      );
      if (is_merge_by_bar) {
        const [_, result] = mergedChannel;
        let str = "";
        const arr = [];
        let prevTime = 0;
        for (const midiNote of result.concat(null)) {
          if (midiNote === null || midiNote.start !== prevTime) {
            str += arr
              .sort((a, b) => a - b)
              .map((v) => rpgen4.piano.note[v - 21])
              .join("");
            str += "\n";
            while (arr.length) {
              arr.pop();
            }
            if (midiNote === null) {
              break;
            }
          }
          arr.push(midiNote.pitch);
          prevTime = midiNote.start;
        }
        rpgen3.addInputStr(foot.empty(), {
          label: "低い音から順に構成音",
          textarea: true,
          copy: true,
          value: str,
        });
      }
    })
    .addClass("btn");
  const mergeChannels = (channels, is_merge_by_bar) => {
    if (channels < 2) return null;
    const heap = new rpgen4.Heap();
    for (const [_, midiNoteArray] of channels) {
      for (const midiNote of midiNoteArray) {
        if (is_merge_by_bar) {
          const unit = 480 * 2;
          midiNote.start = ((midiNote.start / unit) | 0) * unit;
          midiNote.end = midiNote.start + unit;
        }
        heap.add(midiNote.start, midiNote);
      }
    }
    const result = [];
    const now = new Map();
    for (const midiNote of heap) {
      const { pitch, start, end } = midiNote;
      if (now.has(pitch)) {
        const lastMidiNote = now.get(pitch);
        if (lastMidiNote.start === start) {
          lastMidiNote.end = Math.max(lastMidiNote.end, end);
          continue;
        } else if (lastMidiNote.end > start) {
          lastMidiNote.end = start;
        }
      }
      now.set(pitch, midiNote);
      result.push(midiNote);
    }
    return [channels[0][0], result];
  };
})();
