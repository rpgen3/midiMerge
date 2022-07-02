(async () => {
    const {importAll, getScript} = await import(`https://rpgen3.github.io/mylib/export/import.mjs`);
    await Promise.all([
        'https://code.jquery.com/jquery-3.3.1.min.js',
        'https://colxi.info/midi-parser-js/src/main.js'
    ].map(getScript));
    const {$, MidiParser} = window;
    const html = $('body').empty().css({
        'text-align': 'center',
        padding: '1em',
        'user-select': 'none'
    });
    const head = $('<header>').appendTo(html),
          main = $('<main>').appendTo(html),
          foot = $('<footer>').appendTo(html);
    $('<h1>').appendTo(head).text('MIDI分割');
    $('<h2>').appendTo(head).text('指定したタイミングでMIDIを分割');
    const rpgen3 = await importAll([
        [
            'input',
            'css',
            'util'
        ].map(v => `https://rpgen3.github.io/mylib/export/${v}.mjs`)
    ].flat());
    const rpgen4 = await importAll([
        'https://rpgen3.github.io/maze/mjs/heap/Heap.mjs',
        [
            [
                'fixTrack',
                'getTempos',
                'makeMidiNoteSequence',
                'toMIDI'
            ].map(v => `midi/${v}`)
        ].flat().map(v => `https://rpgen3.github.io/piano/mjs/${v}.mjs`)
    ].flat());
    Promise.all([
        [
            'deleteBtn',
            'table'
        ].map(v => `https://rpgen3.github.io/midiSplit/css/${v}.css`),
        [
            'container',
            'tab',
            'img',
            'btn'
        ].map(v => `https://rpgen3.github.io/spatialFilter/css/${v}.css`)
    ].flat().map(rpgen3.addCSS));
    const hideTime = 500;
    const addHideArea = (label, parentNode = main) => {
        const html = $('<div>').addClass('container').appendTo(parentNode);
        const input = rpgen3.addInputBool(html, {
            label,
            save: true,
            value: true
        });
        const area = $('<dl>').appendTo(html);
        input.elm.on('change', () => input() ? area.show(hideTime) : area.hide(hideTime)).trigger('change');
        return Object.assign(input, {
            get html(){
                return area;
            }
        });
    };
    let g_midi = null;
    {
        const {html} = addHideArea('input MIDI file');
        $('<dt>').appendTo(html).text('MIDIファイル');
        const inputFile = $('<input>').appendTo($('<dd>').appendTo(html)).prop({
            type: 'file',
            accept: '.mid'
        });
        MidiParser.parse(inputFile.get(0), v => {
            g_midi = v;
        });
    }
    const makeSafelyGet = m => k => {
        if(!m.has(k)) m.set(k, []);
        return m.get(k);
    };
    let isMergeList = null;
    rpgen3.addBtn(main, 'view channels', () => {
        if(!g_midi) return table.text('Error: Must input MIDI file.');
        const midiNoteSequence = rpgen4.makeMidiNoteSequence(g_midi);
        const channels = new Map;
        const get = makeSafelyGet(channels);
        for(const midiNote of midiNoteSequence) get(midiNote.ch).push(midiNote);
        table.empty();
        const tr = $('<tr>').appendTo($('<thead>').appendTo(table));
        for(const v of [
            'ch',
            'notes',
            'isMerge'
        ]) $('<th>').appendTo(tr).text(v);
        isMergeList = [...channels.keys()].sort((a, b) => a - b).map(ch => {
            for(const v of [
                ch,
                get(ch).length
            ]) $('<td>').appendTo(tr).text(v);
            return [ch, rpgen3.addInputBool($('<td>').appendTo(tr))];
        });
    }).addClass('btn');
    const table = $('<table>').appendTo(addHideArea('channels').html);
    rpgen3.addBtn(main, 'start merge', () => {
        if(!g_midi) return table.text('Error: Must input MIDI file.');
        const {timeDivision} = g_midi;
        const tempos = rpgen4.getTempos(g_midi);
        rpgen3.download(
            rpgen4.toMIDI({
                tracks,
                bpm: rpgen4.toggleTempoAndBpm([...tempos][0]),
                div: timeDivision
            }),
            `midiMerge.mid`
        );
    }).addClass('btn');
    const toMidiTrack = (units, time) => {
        const heap = new rpgen4.Heap();
        for(const {
            pitch,
            velocity,
            start,
            end
        } of units) {
            for(const [i, v] of [
                start - time,
                end - time
            ].entries()) heap.add(v, {
                pitch,
                velocity: i === 0 ? 100 : 0,
                when: v
            });
        }
        return rpgen4.fixTrack([...heap]);
    };
})();
